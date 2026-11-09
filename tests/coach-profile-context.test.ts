import { afterAll, beforeAll, expect, test } from "bun:test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { profileContextBlock, runCoachTool } from "../src/lib/coach-tools";

const url = process.env.SUPABASE_URL, adminKey = process.env.SUPABASE_SERVICE_ROLE_KEY, publicKey = process.env.SUPABASE_PUBLISHABLE_KEY;
const serverTest = url && adminKey && publicKey ? test : test.skip;
let admin: SupabaseClient; const ids: string[] = [];
async function account() {
  const password = crypto.randomUUID() + "Aa9!", email = `coach-ctx-${crypto.randomUUID()}@example.com`;
  const r = await admin.auth.admin.createUser({ email, password, email_confirm: true }); if (r.error) throw r.error;
  ids.push(r.data.user!.id);
  const c = createClient(url!, publicKey!, { auth: { persistSession: false } });
  const l = await c.auth.signInWithPassword({ email, password }); if (l.error) throw l.error;
  return { supabase: c, userId: r.data.user!.id };
}
beforeAll(async () => {
  if (!url || !adminKey) return;
  admin = createClient(url, adminKey, { auth: { persistSession: false }, global: { fetch: (i, init) => { const h = new Headers(init?.headers); if (adminKey.startsWith("sb_")) h.delete("Authorization"); h.set("apikey", adminKey); return fetch(i, { ...init, headers: h }); } } });
});
afterAll(async () => { for (const id of ids) await admin?.auth.admin.deleteUser(id); });

serverTest("server profile block reports saved quick setup as 75%, age raises it to 85%, other user sees none", async () => {
  const A = await account(), B = await account();
  const one = (value: string) => ({ value, confidence: 1 });
  for (const [k, v] of [["goal", "Study"], ["wake_time", "04:00"], ["sleep_time", "23:00"], ["daily_time_available", "3 h+"], ["distraction_trigger", "Phone"], ["intensity", "Hardcore"]])
    await runCoachTool(A, "update_profile", { slots: { [k]: one(v) } });
  const block = await profileContextBlock(A, "test");
  expect(block).toContain('percent="75"');
  expect(block).toContain('"missing":["age","energy peak","weakest habit"]');
  expect(block).toContain('"goal":"Study"');
  const status = await runCoachTool(A, "get_profile_status", {}) as any;
  expect(status.percent).toBe(75);
  expect(status.filled).toMatchObject({ goal: "Study", "wake time": "04:00", "main distraction": "Phone", intensity: "Hardcore" });
  // update_profile(field, value): a spoken age "22" is saved as the 18_24 bucket
  const r = await runCoachTool(A, "update_profile", { field: "age_range", value: "22" }) as any;
  expect(r.percent).toBe(85);
  expect(await profileContextBlock(A, "test")).toContain('percent="85"');
  expect(await profileContextBlock(B, "test")).toContain('percent="0"');
  const peek = await B.supabase.from("coach_profile").select("user_id").eq("user_id", A.userId);
  expect(peek.data ?? []).toHaveLength(0);
}, 60000);
