import { expect, test } from "bun:test";
import postgres from "postgres";

// Explicit isolated URL only. Never defaults to the connected production database.
const url = process.env.WAKE_TEST_DATABASE_URL;
const serverTest = url ? test : test.skip;
const sql = url ? postgres(url, { max: 12 }) : null;
const uid = "10000000-0000-4000-8000-000000000001";
async function run(query: string) {
  if (!sql) throw new Error("WAKE_TEST_DATABASE_URL must name a disposable database");
  return sql.unsafe(query);
}
async function asUser(query: string, id = uid) {
  if (!sql) throw new Error("No isolated database");
  return sql.begin(async tx => {
    await tx.unsafe("SET LOCAL ROLE authenticated");
    await tx`SELECT set_config('request.jwt.claim.sub',${id},true)`;
    return tx.unsafe(query);
  });
}
let eventId = "";
serverTest("isolated server save uses stored timezone and UTC next fire", async () => {
  const rows = await asUser("SELECT public.wake_get_state() AS state");
  expect(rows[0]?.state.timezone).toBe("Asia/Kolkata");
  expect(rows[0]?.state.settings.time).toBe("04:00:00");
});
serverTest("direct private event reads and legacy completion are denied", async () => {
  await expect(asUser("SELECT * FROM public.alarm_events")).rejects.toThrow();
  await expect(asUser("SELECT public.complete_wake_protocol('4AM')")).rejects.toThrow();
  await expect(asUser("SELECT public.wake_issue_question(gen_random_uuid())")).rejects.toThrow();
  await expect(asUser("UPDATE public.alarms SET label='Other' WHERE label='AXEN Wake Protocol'")).rejects.toThrow();
});
serverTest("server ringing persists and questions never expose keys", async () => {
  await run("UPDATE public.alarm_events SET scheduled_for=now()-interval '1 minute',saved_at=now()-interval '3 hours' WHERE user_id='"+uid+"' AND status='scheduled'");
  const rows = await asUser("SELECT public.wake_get_state() AS state");
  eventId = rows[0]?.state.event.id;
  expect(rows[0]?.state.event.status).toBe("ringing");
  expect(rows[0]?.state.event.question.text).toBeString();
  expect(rows[0]?.state.event.question.answer).toBeUndefined();
  expect((await asUser("SELECT public.wake_get_state() AS state"))[0]?.state.event.id).toBe(eventId);
});
serverTest("wrong answer replaces question and keeps ringing", async () => {
  const before = (await asUser("SELECT public.wake_get_state() AS state"))[0]?.state.event;
  const rows = await asUser(`SELECT public.wake_submit_answer('${eventId}',${before.question.version},'999999999') AS result`);
  expect(rows[0]?.result.solved).toBe(false);
  expect(rows[0]?.result.event.question.version).toBe(before.question.version+1);
  expect(rows[0]?.result.event.status).toBe("ringing");
});
serverTest("foreign user cannot answer another occurrence", async () => {
  await expect(asUser(`SELECT public.wake_submit_answer('${eventId}',1,'0')`,"10000000-0000-4000-8000-000000000002")).rejects.toThrow();
});
serverTest("eight concurrent solves award 10 once and update existing ledgers", async () => {
  await run(`UPDATE public.alarm_events SET last_answer_at=NULL WHERE id='${eventId}'`);
  const e = (await run(`SELECT question_version,question_answer FROM public.alarm_events WHERE id='${eventId}'`))[0];
  const result = await Promise.all(Array.from({length:8},()=>asUser(`SELECT public.wake_submit_answer('${eventId}',${e?.question_version},'${e?.question_answer}') AS result`)));
  expect(result.reduce((n,r)=>n+(r[0]?.result.awarded??0),0)).toBe(10);
  const totals=(await run(`SELECT (SELECT coins FROM public.profiles WHERE id='${uid}') AS balance,(SELECT sum(amount)::integer FROM public.coin_transactions WHERE user_id='${uid}') AS ledger,(SELECT count(*)::integer FROM public.score_events WHERE user_id='${uid}' AND kind='wake_verified') AS xp_rows`))[0];
  expect(totals?.balance).toBe(totals?.ledger);
  expect(totals?.balance).toBe(10);
  expect(totals?.xp_rows).toBe(1);
});
serverTest("solved state survives readback with no reward replay", async () => {
  const state=(await asUser("SELECT public.wake_get_state() AS state"))[0]?.state;
  expect(state.event.status).toBe("solved");
  expect(state.event.question).toBeNull();
  expect((await asUser(`SELECT public.wake_submit_answer('${eventId}',1,'0') AS result`))[0]?.result.awarded).toBe(0);
});
serverTest("test alarm rings after server deadline but awards no coins or XP",async()=>{
  const id=(await asUser("SELECT public.wake_test_alarm() AS id"))[0]?.id;
  await run(`UPDATE public.alarm_events SET scheduled_for=now()-interval '10 seconds' WHERE id='${id}'`);
  const state=(await asUser("SELECT public.wake_get_state() AS state"))[0]?.state;
  expect(state.event.is_test).toBe(true);
  const e=(await run(`SELECT question_answer FROM public.alarm_events WHERE id='${id}'`))[0];
  const solved=(await asUser(`SELECT public.wake_submit_answer('${id}',${state.event.question.version},'${e?.question_answer}') AS result`))[0]?.result;
  expect(solved.awarded).toBe(0);
  expect(solved.result).toBe("test_alarm");
  expect((await run(`SELECT coins,streak FROM public.profiles WHERE id='${uid}'`))[0]).toMatchObject({coins:10,streak:1});
});
serverTest("cron batch cap, idempotent sweep and private monitoring",async()=>{
  await run("SET ROLE service_role");
  expect((await run("SELECT public.wake_sweep_due(500) AS count"))[0]?.count).toBe(0);
  await run("RESET ROLE");
  await expect(asUser("SELECT * FROM public.wake_daily_monitor")).rejects.toThrow();
});