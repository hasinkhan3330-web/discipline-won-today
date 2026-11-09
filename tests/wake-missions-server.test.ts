import { afterAll, beforeAll, expect, test } from "bun:test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cleanupWakeUser } from "./wake-test-cleanup";

// Live check with temporary accounts (deleted afterwards). Setup/backdating uses the service key;
// every mission/answer call is made as the signed-in temporary user.
const url = process.env.SUPABASE_URL, adminKey = process.env.SUPABASE_SERVICE_ROLE_KEY, publicKey = process.env.SUPABASE_PUBLISHABLE_KEY;
const serverTest = url && adminKey && publicKey && process.env.WAKE_MISSION_LIVE ? test : test.skip;
let admin: SupabaseClient;
const ids: string[] = [];
type Acc = { id: string; c: SupabaseClient };

async function account(): Promise<Acc> {
  const password = crypto.randomUUID() + "Aa9!", email = `wake-mission-${crypto.randomUUID()}@example.com`;
  const r = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (r.error || !r.data.user) throw Error(r.error?.message);
  ids.push(r.data.user.id);
  const c = createClient(url!, publicKey!, { auth: { persistSession: false } });
  const l = await c.auth.signInWithPassword({ email, password }); if (l.error) throw Error(l.error.message);
  return { id: r.data.user.id, c };
}
beforeAll(() => { if (url && adminKey) admin = createClient(url, adminKey, { auth: { persistSession: false } }); });
afterAll(async () => { for (const id of ids) expect(await cleanupWakeUser(admin, id)).toBe(true); }, 180000);

const rpc = async (a: Acc, fn: string, args: object) => { const r = await a.c.rpc(fn, args); if (r.error) throw Error(r.error.message); return r.data; };
const unthrottle = (id: string) => admin.from("alarm_events").update({ last_answer_at: null }).eq("id", id);

async function ringing(mode: string) {
  const a = await account();
  await admin.from("profiles").update({ reward_timezone: "Asia/Kolkata" }).eq("id", a.id);
  await rpc(a, "wake_save_settings", { _time: "04:00", _sleep: "21:00", _tone: "classic", _mode: mode, _enabled: true, _repeat: true, _difficulty: 2 });
  const iso = (ms: number) => new Date(Date.now() - ms).toISOString();
  await admin.from("alarm_events").update({ scheduled_for: iso(60e3), saved_at: iso(3 * 3600e3) }).eq("user_id", a.id).eq("status", "scheduled");
  const st = await rpc(a, "wake_get_state", {});
  await admin.from("alarm_events").update({ first_ring_at: iso(60e3), mission_issued_at: iso(120e3), last_answer_at: null }).eq("id", st.event.id);
  return { a, ev: st.event };
}
async function outcome(a: Acc) {
  const [p, s, x, al, sc] = await Promise.all([
    admin.from("profiles").select("coins,streak").eq("id", a.id).single(),
    admin.from("alarm_sessions").select("id", { count: "exact", head: true }).eq("user_id", a.id),
    admin.from("score_events").select("points").eq("user_id", a.id).eq("kind", "wake_verified"),
    admin.from("alarms").select("wake_next_fire_at,is_active").eq("user_id", a.id).single(),
    admin.from("alarm_events").select("id", { count: "exact", head: true }).eq("user_id", a.id).eq("status", "scheduled"),
  ]);
  return { coins: p.data?.coins, streak: p.data?.streak, sessions: s.count, xp: (x.data ?? []).map(r => r.points), next: Date.parse(al.data?.wake_next_fire_at) > Date.now(), active: al.data?.is_active, scheduled: sc.count };
}

serverTest("Shake/Typing/Tiles match Math rewards, streak and next occurrence; second completion pays nothing", async () => {
  const m = await ringing("math");
  const { data: q } = await admin.from("alarm_events").select("question_answer").eq("id", m.ev.id).single();
  const mr = await rpc(m.a, "wake_submit_answer", { _event_id: m.ev.id, _version: m.ev.question.version, _answer: q!.question_answer });
  expect(mr.solved).toBe(true);
  const base = await outcome(m.a);
  console.log("math baseline", mr.awarded, mr.result, JSON.stringify(base));
  const proofs: Record<string, (ev: { question: { text: string } }) => object> = {
    shake: () => ({ elapsed_ms: 6000, shakes: 40 }),
    typing: ev => ({ elapsed_ms: 30000, typed: JSON.parse(ev.question.text).sentences.map((s: string) => s.toUpperCase()) }),
    tiles: () => ({ elapsed_ms: 8000, taps: 6, targets: 6 }),
  };
  for (const mode of ["shake", "typing", "tiles"]) {
    const u = await ringing(mode);
    expect(JSON.parse(u.ev.question.text).mission).toBe(mode);
    const r = await rpc(u.a, "wake_complete_mission", { _event_id: u.ev.id, _version: u.ev.question.version, _proof: proofs[mode]!(u.ev) });
    expect(r.solved).toBe(true);
    expect(r.awarded).toBe(mr.awarded);
    expect(r.result).toBe(mr.result);
    expect(await outcome(u.a)).toEqual(base);
    await unthrottle(u.ev.id);
    const again = await rpc(u.a, "wake_complete_mission", { _event_id: u.ev.id, _version: u.ev.question.version, _proof: { elapsed_ms: 9000, shakes: 99 } });
    expect(again.awarded).toBe(0);
    expect(await outcome(u.a)).toEqual(base);
  }
}, 120000);

serverTest("implausible proofs are rejected, logged and rate-limited while the alarm keeps ringing", async () => {
  const u = await ringing("shake");
  const send = async (proof: object) => { await unthrottle(u.ev.id); return rpc(u.a, "wake_complete_mission", { _event_id: u.ev.id, _version: u.ev.question.version, _proof: proof }); };
  expect((await send({ elapsed_ms: 6000, shakes: 39 })).solved).toBe(false);
  expect((await send({ elapsed_ms: 1000, shakes: 40 })).solved).toBe(false);
  await admin.from("alarm_events").update({ mission_issued_at: new Date().toISOString() }).eq("id", u.ev.id);
  const r = await send({ elapsed_ms: 6000, shakes: 40 });
  expect(r.solved).toBe(false); expect(r.event.status).toBe("ringing");
  await send({ elapsed_ms: 0 }); await send({ elapsed_ms: 0 });
  await expect(send({ elapsed_ms: 6000, shakes: 40 })).rejects.toThrow(/Too many attempts/);
  const { count } = await admin.from("wake_delivery_log").select("id", { count: "exact", head: true }).eq("event_id", u.ev.id).eq("kind", "mission_rejected");
  expect(count).toBe(5);

  const t = await ringing("typing");
  const sent = JSON.parse(t.ev.question.text).sentences as string[];
  const tsend = async (proof: object) => { await unthrottle(t.ev.id); return rpc(t.a, "wake_complete_mission", { _event_id: t.ev.id, _version: t.ev.question.version, _proof: proof }); };
  expect((await tsend({ elapsed_ms: Math.floor(sent.join("").length / 13 * 1000), typed: sent })).solved).toBe(false);
  expect((await tsend({ elapsed_ms: 60000, typed: ["nope"] })).solved).toBe(false);

  const g = await ringing("tiles");
  const gsend = async (proof: object) => { await unthrottle(g.ev.id); return rpc(g.a, "wake_complete_mission", { _event_id: g.ev.id, _version: g.ev.question.version, _proof: proof }); };
  expect((await gsend({ elapsed_ms: 60000, taps: 2, targets: 2 })).solved).toBe(false);
  expect((await gsend({ elapsed_ms: 3000, taps: 6, targets: 6 })).solved).toBe(false);
}, 120000);

serverTest("math cannot be finished by the mission function; foreign, anon and private functions denied", async () => {
  const m = await ringing("math");
  await expect(rpc(m.a, "wake_complete_mission", { _event_id: m.ev.id, _version: m.ev.question.version, _proof: { elapsed_ms: 9000, shakes: 99 } })).rejects.toThrow(/question challenge/);
  const s = await ringing("shake");
  await expect(rpc(m.a, "wake_complete_mission", { _event_id: s.ev.id, _version: s.ev.question.version, _proof: { elapsed_ms: 9000, shakes: 99 } })).rejects.toThrow();
  const anon = createClient(url!, publicKey!, { auth: { persistSession: false } });
  expect((await anon.rpc("wake_complete_mission", { _event_id: s.ev.id, _version: 1, _proof: {} })).error).not.toBeNull();
  expect((await m.a.c.rpc("wake_finalize_solve", { _event_id: s.ev.id })).error).not.toBeNull();
  const priv = await m.a.c.from("wake_typing_sentences").select("body").limit(1);
  expect(priv.error !== null || (priv.data ?? []).length === 0).toBe(true);
  const { data } = await admin.from("alarm_events").select("status").eq("id", s.ev.id).single();
  expect(data?.status).toBe("ringing");
}, 120000);
