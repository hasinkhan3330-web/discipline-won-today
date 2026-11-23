import { afterAll, beforeAll, expect, test } from "bun:test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { runVoiceToolCalls, VOICE_TOOL_DECLARATIONS, VOICE_SYSTEM_V2, MAX_VOICE_TOOL_CALLS_PER_TURN } from "../src/lib/coach-voice-tools";
import { COACH_SYSTEM_V2, COACH_TOOL_NAMES, COACH_MODEL_TOOL_NAMES, runCoachTool } from "../src/lib/coach-tools";
import { canBuildPlan, PLAN_READY_CONFIDENCE } from "../src/lib/coach-plan-rules";

const url = process.env.SUPABASE_URL, adminKey = process.env.SUPABASE_SERVICE_ROLE_KEY, publicKey = process.env.SUPABASE_PUBLISHABLE_KEY;
const enabled = Boolean(url && adminKey && publicKey) && process.env.AXEN_ISOLATED_TEST_DB === "1"; // never the live database
const serverTest = enabled ? test : test.skip;
let admin: SupabaseClient, U: { id: string; c: SupabaseClient };

beforeAll(async () => {
  if (!enabled) return;
  admin = createClient(url!, adminKey!, { auth: { persistSession: false }, global: { fetch: (i, init) => { const h = new Headers(init?.headers); if (adminKey!.startsWith("sb_")) h.delete("Authorization"); h.set("apikey", adminKey!); return fetch(i, { ...init, headers: h }); } } });
  const password = crypto.randomUUID() + "Aa9!", email = `coach-voice-${crypto.randomUUID()}@example.com`;
  const r = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  const c = createClient(url!, publicKey!, { auth: { persistSession: false } });
  await c.auth.signInWithPassword({ email, password });
  U = { id: r.data.user!.id, c };
}, 60000);
afterAll(async () => {
  if (!enabled) return;
  for (const t of ["plan_tasks", "coach_plan_materialized", "coach_plans", "coach_memory", "coach_profile", "tasks"]) await admin.from(t).delete().eq("user_id", U.id);
  await admin.auth.admin.deleteUser(U.id);
}, 60000);

test("voice declares exactly the same model tools as text, none for mark-done or coins", () => {
  const names = VOICE_TOOL_DECLARATIONS[0].functionDeclarations.map((d) => d.name);
  expect(names).toEqual([...COACH_MODEL_TOOL_NAMES]);
  expect([...names].sort()).toEqual([...COACH_MODEL_TOOL_NAMES].sort());
  expect(names).toHaveLength(9);
  expect(names).toContain("get_profile_status");
  expect(names.some((n) => /done|complete|coin|reward/i.test(n))).toBe(false);
  expect(JSON.stringify(VOICE_TOOL_DECLARATIONS)).not.toContain("additionalProperties");
});
test("voice uses the v2 prompt plus the 'building your plan' and save-only-on-success rules", () => {
  expect(VOICE_SYSTEM_V2.startsWith(COACH_SYSTEM_V2)).toBe(true);
  expect(VOICE_SYSTEM_V2).toMatch(/building your plan/i);
  expect(VOICE_SYSTEM_V2).toMatch(/only say the plan is saved when it returned success:true/i);
  expect(VOICE_SYSTEM_V2).not.toMatch(/confirm_plan|create_plan_draft/);
});
test("forbidden tool names are refused and never run", async () => {
  let ran = 0;
  const out = await runVoiceToolCalls({ supabase: null, userId: "x" }, [{ id: "1", name: "mark_task_done" }, { id: "2", name: "award_coins" }], async () => { ran++; return {}; });
  expect(ran).toBe(0);
  expect(out.functionResponses.map((r) => r.response.ok)).toEqual([false, false]);
  expect(String(out.functionResponses[0].response.error)).toMatch(/forbidden/);
});
test(`more than ${MAX_VOICE_TOOL_CALLS_PER_TURN} calls in a turn: extras refused`, async () => {
  let ran = 0;
  const calls = Array.from({ length: 8 }, (_, i) => ({ id: String(i), name: "get_progress" }));
  const out = await runVoiceToolCalls({ supabase: null, userId: "x" }, calls, async () => { ran++; return { ok: true }; });
  expect(ran).toBe(6);
  expect(out.functionResponses).toHaveLength(8);
  expect(out.functionResponses.slice(6).every((r) => r.response.ok === false)).toBe(true);
});
test("a failing tool returns an error response instead of breaking the session", async () => {
  const out = await runVoiceToolCalls({ supabase: null, userId: "x" }, [{ id: "a", name: "get_progress" }], async () => { throw new Error("db down"); });
  expect(out.functionResponses[0]).toEqual({ id: "a", name: "get_progress", response: { ok: false, error: "db down" } });
});
test(`plan building is blocked below ${PLAN_READY_CONFIDENCE}% profile confidence`, () => {
  expect(canBuildPlan({})).toBe(false);
  const half = Object.fromEntries(["goal", "daily_time_available", "wake_time", "energy_peak"].map((k) => [k, { value: "x", confidence: 1 }]));
  expect(canBuildPlan(half)).toBe(false);
  const most = Object.fromEntries(["goal", "daily_time_available", "sleep_time", "intensity", "distraction_trigger", "wake_time"].map((k) => [k, { value: "x", confidence: 1 }]));
  expect(canBuildPlan(most)).toBe(true);
});

serverTest("each of the 8 tools answers a simulated toolCall with the id/name/response shape", async () => {
  const ctx = { supabase: U.c, userId: U.id };
  const calls = [
    { id: "c1", name: "get_user_context", args: {} },
    { id: "c2", name: "update_profile", args: { slots: { goal: { value: "Read daily", confidence: 0.9 } } } },
    { id: "c3", name: "save_plan", args: { plan_title: "x", tasks: [{ task_date: "2000-01-01", title: "x", duration_minutes: 5 }] } },
    { id: "c4", name: "confirm_plan", args: {} },
    { id: "c5", name: "update_task", args: { day: 2, task_index: 0, title: "x" } },
    { id: "c6", name: "reschedule_tasks", args: { from_day: 2, to_day: 3 } },
  ];
  const a = await runVoiceToolCalls(ctx, calls);
  const b = await runVoiceToolCalls(ctx, [{ id: "c7", name: "save_coach_memory", args: { type: "preference", note: "Likes mornings" } }, { id: "c8", name: "get_progress", args: {} }]);
  const all = [...a.functionResponses, ...b.functionResponses];
  expect(all.map((r) => r.id)).toEqual(["c1", "c2", "c3", "c4", "c5", "c6", "c7", "c8"]);
  for (const r of all) expect(typeof r.response).toBe("object");
  const res = (i: number) => (all[i].response as any).result;
  expect(res(1).ok).toBe(true); // profile saved
  expect(res(2).success).toBe(false); // past date rejected
  expect((all[3].response as any).error).toMatch(/forbidden/); // confirm_plan is not a model tool
  expect(res(4).ok).toBe(false); // no confirmed plan
  expect(res(5).ok).toBe(false);
  expect(res(6).ok).toBe(true);
  const saved = await admin.from("coach_profile").select("slots").eq("user_id", U.id).single();
  expect((saved.data?.slots as any).goal.value).toBe("Read daily");
  const plans = await admin.from("coach_plans").select("id").eq("user_id", U.id);
  expect(plans.data).toHaveLength(0);
}, 60000);

serverTest("save_plan writes plan_tasks, replaces on re-save, never duplicates Home tasks, and is private", async () => {
  const ctx = { supabase: U.c, userId: U.id };
  await U.c.from("coach_profile").upsert({ user_id: U.id, timezone: "Asia/Kolkata" }, { onConflict: "user_id" });
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const d = (n: number) => { const x = new Date(today + "T00:00:00Z"); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
  const tasks = Array.from({ length: 7 }, (_, i) => ({ task_date: d(i), day_number: i + 1, title: `Study ${i + 1}`, duration_minutes: 30 }));
  const r1 = await runCoachTool(ctx, "save_plan", { plan_title: "Week 1", tasks }) as any;
  expect(r1).toEqual({ success: true, saved_count: 7 });
  const r2 = await runCoachTool(ctx, "save_plan", { plan_title: "Week 1b", tasks }) as any;
  expect(r2.success).toBe(true);
  const rows = await U.c.from("plan_tasks").select("id").eq("user_id", U.id);
  expect(rows.data).toHaveLength(7);
  const home = await admin.from("tasks").select("id").eq("user_id", U.id).eq("is_active", true).eq("name", "Study 1");
  expect(home.data?.length ?? 0).toBeLessThanOrEqual(1);
  const got = await runCoachTool(ctx, "get_plan", { from_date: d(0), to_date: d(6) }) as any;
  expect(got.tasks).toHaveLength(7);
  // a second signed-in user sees none of these rows
  const password = crypto.randomUUID() + "Aa9!", email = `coach-other-${crypto.randomUUID()}@example.com`;
  const o = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  const oc = createClient(url!, publicKey!, { auth: { persistSession: false } });
  await oc.auth.signInWithPassword({ email, password });
  const seen = await oc.from("plan_tasks").select("id").eq("user_id", U.id);
  expect(seen.data ?? []).toHaveLength(0);
  await admin.auth.admin.deleteUser(o.data.user!.id);
}, 90000);
