import { beforeAll, expect, test } from "bun:test";
import postgres from "postgres";

const url = process.env.WAKE_TEST_DATABASE_URL;
const isolated = url ? test : test.skip;
const sql = url ? postgres(url, { max: 6 }) : null;
const uid = "10000000-0000-4000-8000-000000000003";
let event = "";
async function user(query: string) {
  if (!sql) throw new Error("Explicit disposable database required");
  return sql.begin(async tx => {
    await tx.unsafe("SET LOCAL ROLE authenticated");
    await tx`SELECT set_config('request.jwt.claim.sub',${uid},true)`;
    return tx.unsafe(query);
  });
}
beforeAll(async () => {
  if (!sql) return;
  await sql`INSERT INTO auth.users(id) VALUES(${uid}) ON CONFLICT DO NOTHING`;
  await sql`INSERT INTO public.profiles(id) VALUES(${uid}) ON CONFLICT DO NOTHING`;
  await user("SELECT public.wake_save_settings('04:00','20:30','classic','science',true,true,2::smallint)");
  const row = (await user("SELECT public.wake_test_alarm() AS id"))[0];
  event = row?.id;
  await sql`UPDATE public.alarm_events SET scheduled_for=now()-interval '10 seconds' WHERE id=${event}`;
  await user("SELECT public.wake_get_state()");
});
isolated("400 sequential science questions have no repeats until exhaustion", async () => {
  if (!sql) throw new Error("Isolated database required");
  const hashes = new Set<string>();
  for (let i = 0; i < 400; i++) {
    const q = (await sql`SELECT question_hash FROM public.alarm_events WHERE id=${event}`)[0];
    expect(hashes.has(q?.question_hash)).toBe(false);
    hashes.add(q?.question_hash);
    await sql`SELECT public.wake_issue_question(${event})`;
  }
  expect(hashes.size).toBe(400);
  const q = (await sql`SELECT question_cycle FROM public.alarm_events WHERE id=${event}`)[0];
  expect(q?.question_cycle).toBe(1);
}, 60000);
isolated("science requires two consecutive answers, wrong resets, test never pays", async () => {
  if (!sql) throw new Error("Isolated database required");
  async function answer(correct: boolean) {
    if (!sql) throw new Error("Isolated database required");
    await sql`UPDATE public.alarm_events SET last_answer_at=NULL WHERE id=${event}`;
    const q = (await sql`SELECT question_version,question_answer FROM public.alarm_events WHERE id=${event}`)[0];
    return (await user(`SELECT public.wake_submit_answer('${event}',${q?.question_version},'${correct ? q?.question_answer : "99"}') AS result`))[0]?.result;
  }
  expect((await answer(true)).solved).toBe(false);
  const wrong = await answer(false);
  expect(wrong.event.question.correct_in_row).toBe(0);
  expect(wrong.event.status).toBe("ringing");
  expect((await answer(true)).solved).toBe(false);
  const solved = await answer(true);
  expect(solved.solved).toBe(true);
  expect(solved.awarded).toBe(0);
  expect(solved.result).toBe("test_alarm");
  expect((await sql`SELECT coins,streak FROM public.profiles WHERE id=${uid}`)[0]).toMatchObject({ coins: 0, streak: 0 });
});
isolated("SQL scheduling agrees on DST gap, fold and local midnight", async () => {
  if (!sql) throw new Error("Isolated database required");
  const rows = await sql`SELECT public.wake_next_fire('02:30','America/New_York','2026-03-08T05:00:00Z') AS gap, public.wake_next_fire('01:30','America/New_York','2026-11-01T04:00:00Z') AS fold, public.wake_next_fire('04:00','Asia/Kolkata','2026-10-14T00:00:00Z') AS local`;
  expect(rows[0]?.gap.toISOString()).toBe("2026-03-08T07:00:00.000Z");
  expect(rows[0]?.fold.toISOString()).toBe("2026-11-01T05:30:00.000Z");
  expect(rows[0]?.local.toISOString()).toBe("2026-10-14T22:30:00.000Z");
});
isolated("private answer rows and award helpers reject authenticated callers", async () => {
  await expect(user("SELECT * FROM public.wake_question_history")).rejects.toThrow();
  await expect(user(`SELECT public.axen_award_completion_coins('${uid}','wake','${event}')`)).rejects.toThrow();
});