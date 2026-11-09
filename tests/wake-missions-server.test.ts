import { expect, test } from "bun:test";
import postgres from "postgres";
import { afterAll, beforeAll } from "bun:test";
import { createClient } from "@supabase/supabase-js";

// Runs entirely inside one transaction that is always rolled back: temporary users, no residue.
const url = process.env.WAKE_MISSION_DATABASE_URL;
const serverTest = url && process.env.SUPABASE_SERVICE_ROLE_KEY ? test : test.skip;
const admin = url ? createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } }) : null;
const users: string[] = [];
beforeAll(async () => {
  if (!url || !admin) return;
  for (let i = 0; i < 10; i++) {
    const r = await admin.auth.admin.createUser({ email: `wake-mission-${crypto.randomUUID()}@example.com`, password: crypto.randomUUID() + "Aa9!", email_confirm: true });
    if (r.error || !r.data.user) throw Error(r.error?.message); users.push(r.data.user.id);
  }
});
afterAll(async () => { for (const id of users) await admin?.auth.admin.deleteUser(id); });

class Rollback extends Error {}
async function inTx(fn: (q: (s: string, uid?: string) => Promise<postgres.RowList<postgres.Row[]>>) => Promise<void>) {
  const sql = postgres(url!, { max: 1 });
  try {
    await sql.begin(async tx => {
      const q = async (s: string, uid?: string) => {
        if (uid) { await tx.unsafe("SET LOCAL ROLE authenticated"); await tx.unsafe(`SELECT set_config('request.jwt.claim.sub','${uid}',true), set_config('request.jwt.claims','{"sub":"${uid}","role":"authenticated"}',true)`); }
        try { return await tx.unsafe(s); } finally { if (uid) await tx.unsafe("RESET ROLE"); }
      };
      await fn(q);
      throw new Rollback();
    });
  } catch (e) { if (!(e instanceof Rollback)) throw e; } finally { await sql.end(); }
}
type Q = Parameters<Parameters<typeof inTx>[0]>[0];

async function ringingUser(q: Q, mode: string, n: number) {
  const uid = users[n]!;
  await q(`UPDATE public.profiles SET reward_timezone='Asia/Kolkata', streak=0, last_activity_date=NULL WHERE id='${uid}'`);
  await q(`SELECT public.wake_save_settings('04:00','21:00','classic','${mode}',true,true,2::smallint)`, uid);
  await q(`UPDATE public.alarm_events SET scheduled_for=now()-interval '1 minute', saved_at=now()-interval '3 hours' WHERE user_id='${uid}' AND status='scheduled'`);
  const st = (await q(`SELECT public.wake_get_state() AS s`, uid))[0]!.s;
  await q(`UPDATE public.alarm_events SET first_ring_at=now()-interval '1 minute', mission_issued_at=now()-interval '2 minutes', last_answer_at=NULL WHERE id='${st.event.id}'`);
  return { uid, ev: st.event };
}
async function outcome(q: Q, uid: string) {
  return (await q(`SELECT (SELECT coins FROM public.profiles WHERE id='${uid}') coins,(SELECT streak FROM public.profiles WHERE id='${uid}') streak,(SELECT count(*)::int FROM public.alarm_sessions WHERE user_id='${uid}') sessions,(SELECT count(*)::int FROM public.score_events WHERE user_id='${uid}' AND kind='wake_verified') xp,(SELECT wake_next_fire_at>now() FROM public.alarms WHERE user_id='${uid}') next_ok,(SELECT count(*)::int FROM public.alarm_events WHERE user_id='${uid}' AND status='scheduled') scheduled`))[0];
}

serverTest("Shake/Typing/Tiles give the same coins, streak, XP and next occurrence as Math; second call pays nothing", async () => {
  await inTx(async q => {
    const m = await ringingUser(q, "math", 1);
    const ans = (await q(`SELECT question_answer a FROM public.alarm_events WHERE id='${m.ev.id}'`))[0]!.a;
    const mr = (await q(`SELECT public.wake_submit_answer('${m.ev.id}',${m.ev.question.version},'${ans}') r`, m.uid))[0]!.r;
    const base = await outcome(q, m.uid);
    expect(mr.solved).toBe(true);
    const proofs: Record<string, (ev: { question: { text: string } }) => object> = {
      shake: () => ({ elapsed_ms: 6000, shakes: 40 }),
      typing: ev => ({ elapsed_ms: 20000, typed: JSON.parse(ev.question.text).sentences.map((s: string) => s.toUpperCase()) }),
      tiles: () => ({ elapsed_ms: 8000, taps: 6, targets: 6 }),
    };
    let n = 2;
    for (const mode of ["shake", "typing", "tiles"]) {
      const u = await ringingUser(q, mode, n++);
      expect(JSON.parse(u.ev.question.text).mission).toBe(mode);
      const r = (await q(`SELECT public.wake_complete_mission('${u.ev.id}',${u.ev.question.version},'${JSON.stringify(proofs[mode]!(u.ev)).replace(/'/g, "''")}'::jsonb) r`, u.uid))[0]!.r;
      expect(r.solved).toBe(true);
      expect(r.awarded).toBe(mr.awarded);
      expect(r.result).toBe(mr.result);
      expect(await outcome(q, u.uid)).toEqual(base);
      await q(`UPDATE public.alarm_events SET last_answer_at=NULL WHERE id='${u.ev.id}'`);
      const again = (await q(`SELECT public.wake_complete_mission('${u.ev.id}',${u.ev.question.version},'{"elapsed_ms":9000,"shakes":99}'::jsonb) r`, u.uid))[0]!.r;
      expect(again.awarded).toBe(0);
      expect(await outcome(q, u.uid)).toEqual(base);
    }
  });
});

serverTest("implausible proofs are rejected, logged, rate-limited; alarm keeps ringing", async () => {
  await inTx(async q => {
    const u = await ringingUser(q, "shake", 6);
    const bad = async (proof: string) => { await q(`UPDATE public.alarm_events SET last_answer_at=NULL WHERE id='${u.ev.id}'`); return (await q(`SELECT public.wake_complete_mission('${u.ev.id}',${u.ev.question.version},'${proof}'::jsonb) r`, u.uid))[0]!.r; };
    expect((await bad('{"elapsed_ms":6000,"shakes":39}')).solved).toBe(false); // too few
    expect((await bad('{"elapsed_ms":1000,"shakes":40}')).solved).toBe(false); // too fast (client clock)
    await q(`UPDATE public.alarm_events SET mission_issued_at=now()-interval '1 second' WHERE id='${u.ev.id}'`);
    expect((await bad('{"elapsed_ms":6000,"shakes":40}')).solved).toBe(false); // too fast (server clock)
    const r = await bad('{"elapsed_ms":6000,"shakes":40}');
    expect(r.event.status).toBe("ringing");
    await bad('{"elapsed_ms":0}');
    await expect(bad('{"elapsed_ms":6000,"shakes":40}')).rejects.toThrow(/Too many attempts/);
    const logs = (await q(`SELECT count(*)::int c FROM public.wake_delivery_log WHERE event_id='${u.ev.id}' AND kind='mission_rejected'`))[0]!.c;
    expect(logs).toBe(5);

    const t = await ringingUser(q, "typing", 7);
    const sent = JSON.parse(t.ev.question.text).sentences as string[];
    const chars = sent.join("").length;
    const fast = (await q(`SELECT public.wake_complete_mission('${t.ev.id}',${t.ev.question.version},'${JSON.stringify({ elapsed_ms: Math.floor(chars / 13 * 1000), typed: sent }).replace(/'/g, "''")}'::jsonb) r`, t.uid))[0]!.r;
    expect(fast.solved).toBe(false); // >12 chars/sec
    await q(`UPDATE public.alarm_events SET last_answer_at=NULL WHERE id='${t.ev.id}'`);
    const wrong = (await q(`SELECT public.wake_complete_mission('${t.ev.id}',${t.ev.question.version},'{"elapsed_ms":60000,"typed":["nope"]}'::jsonb) r`, t.uid))[0]!.r;
    expect(wrong.solved).toBe(false);

    const g = await ringingUser(q, "tiles", 8);
    const few = (await q(`SELECT public.wake_complete_mission('${g.ev.id}',${g.ev.question.version},'{"elapsed_ms":60000,"taps":2,"targets":2}'::jsonb) r`, g.uid))[0]!.r;
    expect(few.solved).toBe(false);
    await q(`UPDATE public.alarm_events SET last_answer_at=NULL WHERE id='${g.ev.id}'`);
    const quick = (await q(`SELECT public.wake_complete_mission('${g.ev.id}',${g.ev.question.version},'{"elapsed_ms":3000,"taps":6,"targets":6}'::jsonb) r`, g.uid))[0]!.r;
    expect(quick.solved).toBe(false);
  });
});

serverTest("math alarms cannot be finished via the mission function; anon and foreign users denied", async () => {
  await inTx(async q => {
    const m = await ringingUser(q, "math", 9);
    await expect(q(`SELECT public.wake_complete_mission('${m.ev.id}',${m.ev.question.version},'{"elapsed_ms":9000,"shakes":99}'::jsonb)`, m.uid)).rejects.toThrow(/question challenge/);
  });
  await inTx(async q => {
    const s = await ringingUser(q, "shake", 5);
    await expect(q(`SELECT public.wake_complete_mission('${s.ev.id}',${s.ev.question.version},'{"elapsed_ms":9000,"shakes":99}'::jsonb)`, users[4]!)).rejects.toThrow();
  });
  await inTx(async q => {
    await q("SET LOCAL ROLE anon");
    await expect(q(`SELECT public.wake_complete_mission(gen_random_uuid(),1,'{}'::jsonb)`)).rejects.toThrow();
  });
  await inTx(async q => {
    await q("SET LOCAL ROLE authenticated");
    await expect(q(`SELECT public.wake_finalize_solve(gen_random_uuid())`)).rejects.toThrow();
    await expect(q(`SELECT * FROM public.wake_typing_sentences`)).rejects.toThrow();
  });
});
