import { afterAll, beforeAll, expect, test } from "bun:test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { gardenStage, weekDays } from "../src/components/verified/acct/AcctUI";
import { reportTip, validatePact } from "../src/components/verified/acct/AcctScreens";

const url = process.env.SUPABASE_URL, adminKey = process.env.SUPABASE_SERVICE_ROLE_KEY, publicKey = process.env.SUPABASE_PUBLISHABLE_KEY;
const enabled = Boolean(url && adminKey && publicKey);
const serverTest = enabled ? test : test.skip;
let admin: SupabaseClient, anon: SupabaseClient;
type Acc = { id: string; c: SupabaseClient };
let A: Acc, B: Acc, C: Acc;
const ids: string[] = [];
const NEW_FNS = ["acct_garden_score", "acct_partner_garden_stage", "acct_partner_checkin_status", "acct_pair_streak", "acct_weekly_report", "acct_revoke_my_invites"];

async function account(): Promise<Acc> {
  const password = crypto.randomUUID() + "Aa9!", email = `acct-test-${crypto.randomUUID()}@example.com`;
  const r = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (r.error || !r.data.user) throw Error(r.error?.message);
  ids.push(r.data.user.id);
  const c = createClient(url!, publicKey!, { auth: { persistSession: false } });
  const l = await c.auth.signInWithPassword({ email, password }); if (l.error) throw Error(l.error.message);
  return { id: r.data.user.id, c };
}
const hex = async (s: string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)))).map(b => b.toString(16).padStart(2, "0")).join("");
const today = (tz = "Asia/Kolkata") => new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

beforeAll(async () => {
  if (!enabled) return;
  admin = createClient(url!, adminKey!, { auth: { persistSession: false }, global: { fetch: (i, init) => { const h = new Headers(init?.headers); if (adminKey!.startsWith("sb_")) h.delete("Authorization"); h.set("apikey", adminKey!); return fetch(i, { ...init, headers: h }); } } });
  anon = createClient(url!, publicKey!, { auth: { persistSession: false } });
  A = await account(); B = await account(); C = await account();
  const code = crypto.randomUUID().replace(/-/g, "").toUpperCase();
  const inv = await A.c.rpc("create_accountability_invite", { _token_hash: await hex(code) }); if (inv.error) throw Error(inv.error.message);
  const acc = await B.c.rpc("accept_accountability_invite", { _token_hash: await hex(code) }); if (acc.error) throw Error(acc.error.message);
}, 60000);

afterAll(async () => {
  if (!enabled) return;
  for (const t of ["acct_cheers", "acct_checkins", "acct_settings", "acct_milestones_seen"]) await admin.from(t).delete().in(t === "acct_cheers" ? "sender_id" : "user_id", ids);
  await admin.from("accountability_events").delete().in("actor_id", ids);
  await admin.from("accountability_connections").delete().in("user_id", ids);
  await admin.from("accountability_invites").delete().in("inviter_id", ids);
  await admin.from("contract_events").delete().in("user_id", ids);
  await admin.from("daily_contracts").delete().in("user_id", ids);
  // Partner history is append-only by design, so partnered test accounts may need a separate operator cleanup.
  for (const id of ids) { const r = await admin.auth.admin.deleteUser(id); if (r.error) console.warn(`[cleanup] test account ${id} kept: partner history is append-only`); }
}, 60000);

// ---- pure rules ----
test("garden stage thresholds: Seed 0-19, Sapling 20-39, Young 40-59, Lush 60-79, Ancient 80-100", () => {
  expect([0, 19, 20, 39, 40, 59, 60, 79, 80, 100].map(gardenStage)).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
});
test("one-time pacts only today or tomorrow; deadline after session", () => {
  const now = new Date(2026, 10, 7, 10, 0);
  const ok = { title: "Read", start: "2026-11-07T11:00", minutes: 30, deadline: "2026-11-07T12:00" };
  expect(validatePact(ok, now)).toBeNull();
  expect(validatePact({ ...ok, start: "2026-11-08T11:00", deadline: "2026-11-08T12:00" }, now)).toBeNull();
  expect(validatePact({ ...ok, start: "2026-11-09T11:00", deadline: "2026-11-09T12:00" }, now)).toMatch(/today or tomorrow/);
  expect(validatePact({ ...ok, deadline: "2026-11-07T11:10" }, now)).toMatch(/Deadline/);
});
test("week strip marks today and future", () => {
  const d = weekDays(new Date(2026, 10, 7), { "2026-11-02": "done", "2026-11-03": "missed" });
  expect(d.map(x => x.state)).toEqual(["done", "missed", "none", "none", "none", "today", "future"]);
});
test("weekly tip uses real numbers only and has an empty-state message", () => {
  expect(reportTip({ total: 0, completed: 0, missed: 0, recovered: 0, pending_reviews: 0, avg_review_minutes: null, focus_minutes: 0, days: [], best_day: null })).toMatch(/Create one small pact/);
});

// ---- server rules ----
serverTest("anon cannot execute any new function", async () => {
  for (const f of NEW_FNS) expect((await anon.rpc(f)).error).not.toBeNull();
  expect((await anon.rpc("acct_send_cheer", { _kind: "fire" })).error).not.toBeNull();
});
serverTest("user A cannot read user B's check-ins, settings or milestones", async () => {
  expect((await B.c.from("acct_checkins").insert({ user_id: B.id, day: today(), action: "Study", completed: true })).error).toBeNull();
  expect((await B.c.from("acct_milestones_seen").insert({ kind: "pair_streak", milestone: 3 })).error).toBeNull();
  expect((await A.c.from("acct_checkins").select("id").eq("user_id", B.id)).data).toEqual([]);
  expect((await A.c.from("acct_milestones_seen").select("milestone").eq("user_id", B.id)).data).toEqual([]);
  expect((await A.c.from("acct_checkins").insert({ user_id: B.id, day: today() })).error).not.toBeNull();
});
serverTest("partner check-in status only for accepted partner", async () => {
  expect((await A.c.rpc("acct_partner_checkin_status")).data).toEqual({ checked_in: true, completed: true });
  expect((await C.c.rpc("acct_partner_checkin_status")).data).toBeNull();
});
serverTest("partner tree only when accepted AND show_tree is on", async () => {
  expect((await A.c.rpc("acct_partner_garden_stage")).data).toEqual({ stage: 1, stage_name: "Seed" });
  expect((await C.c.rpc("acct_partner_garden_stage")).data).toBeNull();
  expect((await B.c.from("acct_settings").upsert({ user_id: B.id, show_tree: false })).error).toBeNull();
  expect((await A.c.rpc("acct_partner_garden_stage")).data).toBeNull();
  await B.c.from("acct_settings").upsert({ user_id: B.id, show_tree: true });
});
serverTest("new user garden starts at Seed with check-in credit only", async () => {
  const g = (await B.c.rpc("acct_garden_score")).data as any;
  expect(g.stage).toBe(1); expect(g.score).toBe(2); // 15 * 1/7 rounded
  expect((await C.c.rpc("acct_garden_score")).data).toMatchObject({ score: 0, stage: 1, stage_name: "Seed", points_to_next: 20 });
});
serverTest("pair streak: partner 0, non-partner has no partner", async () => {
  expect((await A.c.rpc("acct_pair_streak")).data).toEqual({ has_partner: true, streak: 0, milestone: null });
  expect((await C.c.rpc("acct_pair_streak")).data).toMatchObject({ has_partner: false });
});
serverTest("weekly report is empty for a new user", async () => {
  expect((await C.c.rpc("acct_weekly_report")).data).toMatchObject({ total: 0, completed: 0, missed: 0, recovered: 0, focus_minutes: 0, best_day: null });
});
serverTest("cheers: partner once per kind per day; non-partner refused", async () => {
  expect((await A.c.rpc("acct_send_cheer", { _kind: "fire" })).data).toBe(true);
  expect((await A.c.rpc("acct_send_cheer", { _kind: "fire" })).data).toBe(false);
  expect((await C.c.rpc("acct_send_cheer", { _kind: "fire" })).error).not.toBeNull();
  expect((await B.c.from("acct_cheers").select("kind")).data).toEqual([{ kind: "fire" }]);
  expect((await C.c.from("acct_cheers").select("kind")).data).toEqual([]);
});
serverTest("pact created in Accountability shows in the Home card query; guard still blocks server fields", async () => {
  const st = new Date(Date.now() + 2 * 3600_000);
  const row = { user_id: C.id, goal_id: null, title: "Read 20 pages", category: "reading", scheduled_at: st.toISOString(), timezone: "Asia/Kolkata",
    local_day: today(), planned_seconds: 1800, rescue_seconds: 600, proof_method: "timer", difficulty: 2, reminder_pref: "none",
    accountability_enabled: false, status: "scheduled", deadline_at: new Date(st.getTime() + 3600_000).toISOString(),
    is_solo: true, partner_visibility: "private", minimum_version: "5 pages", obstacles: "phone", evidence_required: "session" };
  const ins = await C.c.from("daily_contracts").insert(row).select("id").single();
  expect(ins.error).toBeNull();
  const home = await C.c.from("daily_contracts").select("id,is_solo,minimum_version").eq("is_recovery", false).gte("local_day", today()).neq("status", "cancelled").order("scheduled_at").limit(1);
  expect(home.data?.[0]).toEqual({ id: ins.data!.id, is_solo: true, minimum_version: "5 pages" });
  expect((await C.c.from("daily_contracts").update({ xp_awarded: 99 }).eq("id", ins.data!.id)).error).not.toBeNull();
  expect((await C.c.from("daily_contracts").update({ paused_at: new Date().toISOString() }).eq("id", ins.data!.id)).error).toBeNull();
  expect((await A.c.from("daily_contracts").select("id").eq("id", ins.data!.id)).data).toEqual([]);
});
serverTest("revoke my invites works and only touches the caller", async () => {
  const code = crypto.randomUUID().replace(/-/g, "").toUpperCase();
  expect((await C.c.rpc("create_accountability_invite", { _token_hash: await hex(code) })).error).toBeNull();
  expect((await A.c.rpc("acct_revoke_my_invites")).data).toBe(0);
  expect((await C.c.rpc("acct_revoke_my_invites")).data).toBe(1);
  expect((await A.c.rpc("accept_accountability_invite", { _token_hash: await hex(code) })).error).not.toBeNull();
});
