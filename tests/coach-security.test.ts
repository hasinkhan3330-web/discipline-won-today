import { afterAll, beforeAll, expect, test } from "bun:test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { materializeToday } from "../src/lib/coach-tools";
import { localDay } from "../src/lib/coach-plan-rules";

const url = process.env.SUPABASE_URL, adminKey = process.env.SUPABASE_SERVICE_ROLE_KEY, publicKey = process.env.SUPABASE_PUBLISHABLE_KEY;
const enabled = Boolean(url && adminKey && publicKey);
const serverTest = enabled ? test : test.skip;
let admin: SupabaseClient;
type Acc = { id: string; c: SupabaseClient };
let A: Acc, B: Acc;
const ids: string[] = [];
const TZ = "Asia/Kolkata";

async function account(): Promise<Acc> {
  const password = crypto.randomUUID() + "Aa9!", email = `coach-test-${crypto.randomUUID()}@example.com`;
  const r = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (r.error || !r.data.user) throw Error(r.error?.message);
  ids.push(r.data.user.id);
  const c = createClient(url!, publicKey!, { auth: { persistSession: false } });
  const l = await c.auth.signInWithPassword({ email, password }); if (l.error) throw Error(l.error.message);
  return { id: r.data.user.id, c };
}

const plan = { days: [{ day: 1, tasks: [
  { title: "Read", minimum: "Read 1 page", trigger: "after tea", time: "08:00", minutes: 10, difficulty: "easy" },
  { title: "Walk", minimum: "Walk 2 min", trigger: "after lunch", time: "13:00", minutes: 10, difficulty: "easy" },
] }] };
let planId = "", ownHabitId = "";

beforeAll(async () => {
  if (!enabled) return;
  admin = createClient(url!, adminKey!, { auth: { persistSession: false }, global: { fetch: (i, init) => { const h = new Headers(init?.headers); if (adminKey!.startsWith("sb_")) h.delete("Authorization"); h.set("apikey", adminKey!); return fetch(i, { ...init, headers: h }); } } });
  A = await account(); B = await account();
  const p = await A.c.from("coach_profile").upsert({ user_id: A.id, timezone: TZ, slots: { goal: { value: "secret", confidence: 1 } } });
  if (p.error) throw Error(p.error.message);
  const ins = await A.c.from("coach_plans").insert({ user_id: A.id, status: "confirmed", days: 1, goal: "secret", plan, start_date: localDay(TZ), confirmed_at: new Date().toISOString() }).select("id").single();
  if (ins.error) throw Error(ins.error.message);
  planId = ins.data.id;
  const h = await A.c.from("tasks").insert({ user_id: A.id, name: "My own habit", icon: "★", pts: 10, frequency: "daily" }).select("id").single();
  if (h.error) throw Error(h.error.message);
  ownHabitId = h.data.id;
}, 60000);

afterAll(async () => {
  if (!enabled) return;
  await admin.from("coach_plan_materialized").delete().in("user_id", ids);
  await admin.from("coach_plans").delete().in("user_id", ids);
  await admin.from("coach_profile").delete().in("user_id", ids);
  await admin.from("tasks").delete().in("user_id", ids);
  for (const id of ids) await admin.auth.admin.deleteUser(id);
}, 60000);

serverTest("another user cannot read my coach profile or plans", async () => {
  const p = await B.c.from("coach_profile").select("*").eq("user_id", A.id);
  const pl = await B.c.from("coach_plans").select("*").eq("user_id", A.id);
  expect(p.data ?? []).toHaveLength(0);
  expect(pl.data ?? []).toHaveLength(0);
});

serverTest("another user cannot write my coach profile or plans", async () => {
  await B.c.from("coach_profile").update({ timezone: "UTC", slots: {} }).eq("user_id", A.id);
  await B.c.from("coach_plans").update({ goal: "hacked" }).eq("id", planId);
  const forged = await B.c.from("coach_plans").insert({ user_id: A.id, status: "draft", days: 7, plan });
  const forgedProfile = await B.c.from("coach_profile").insert({ user_id: A.id, timezone: "UTC" });
  expect(forged.error).not.toBeNull();
  expect(forgedProfile.error).not.toBeNull();
  const p = await admin.from("coach_profile").select("timezone").eq("user_id", A.id).single();
  const pl = await admin.from("coach_plans").select("goal").eq("id", planId).single();
  expect(p.data?.timezone).toBe(TZ);
  expect(pl.data?.goal).toBe("secret");
});

serverTest("materializing the same day twice creates no duplicate tasks", async () => {
  const first = await materializeToday({ supabase: A.c, userId: A.id } as any);
  const second = await materializeToday({ supabase: A.c, userId: A.id } as any);
  expect(first.added).toBe(2);
  expect(second.added).toBe(0);
  const rows = await admin.from("coach_plan_materialized").select("task_id").eq("plan_id", planId);
  expect(rows.data).toHaveLength(2);
  const all = await admin.from("tasks").select("id,name").eq("user_id", A.id);
  expect(all.data).toHaveLength(3); // 2 plan tasks + the user's own habit
});

serverTest("retiring old plan tasks never touches the user's own habits", async () => {
  // pretend the plan tasks were from yesterday, then reopen the app
  await admin.from("coach_plan_materialized").update({ local_day: "2000-01-01" }).eq("plan_id", planId);
  await materializeToday({ supabase: A.c, userId: A.id } as any);
  const own = await admin.from("tasks").select("is_active").eq("id", ownHabitId).single();
  expect(own.data?.is_active).toBe(true);
  const rows = await admin.from("coach_plan_materialized").select("task_id").eq("plan_id", planId);
  const plans = await admin.from("tasks").select("is_active").in("id", rows.data!.map((r) => r.task_id));
  expect(plans.data!.every((t) => t.is_active === false)).toBe(true);
});
