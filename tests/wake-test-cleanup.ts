import type { SupabaseClient } from "@supabase/supabase-js";

// Same order as tests/wake-live-capture.py: event-linked rows first, then user rows, then the account.
const USER_TABLES = ["wake_question_history", "alarm_events", "alarm_sessions", "score_events", "coin_transactions", "task_completions", "tasks", "alarms", "app_trials", "entitlements", "first_launch_assessments"];
export async function cleanupWakeUser(admin: SupabaseClient, uid: string) {
  const { data: events } = await admin.from("alarm_events").select("id").eq("user_id", uid);
  const ids = (events ?? []).map(e => e.id);
  if (ids.length) for (const t of ["wake_delivery_log", "wake_push_outbox"]) await admin.from(t).delete().in("event_id", ids);
  await admin.from("wake_push_subscriptions").delete().eq("user_id", uid);
  for (const t of USER_TABLES) await admin.from(t).delete().eq("user_id", uid);
  const r = await admin.auth.admin.deleteUser(uid);
  return !r.error;
}
