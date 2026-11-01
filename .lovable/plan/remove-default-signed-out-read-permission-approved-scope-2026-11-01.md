# Remove default signed-out read permission (approved scope)

## What the check found
- All 51 public tables have row-level access rules turned ON.
- None of those rules let signed-out visitors read anything.
- 33 tables still keep the database's default signed-out permission. The access rules block it today, but that leaves only one layer of protection.
- No signed-out page reads these tables: login, signup, password reset, pricing (/pro), privacy, terms and refund. Sign-in goes through the separate login system, which this change doesn't touch. The payment and wake background routes use the server's own access, not signed-out access.
- So none of these tables needs to stay open to signed-out visitors.

## Change
Remove signed-out (anon) permissions from the 33 tables that still have them. Signed-in access, every access rule, screens, coins, rewards and payments stay unchanged.

## Technical details
- One migration: `REVOKE ALL ON public.<t> FROM anon;` for accountability_pacts, alarm_sessions, alarms, app_trials, billing_notifications, billing_plans, coach_conversations, coach_messages, coach_notes, coach_sessions, coin_transactions, daily_top_tasks, entitlements, first_launch_assessments, focus_sessions, friendships, goal_habits, goals, habit_reminders, pact_nudges, payment_events, profiles, quiz_attempts, score_events, streak_shield_uses, subscriptions, task_completions, tasks, unlock_rewards, vision_verifications, wake_delivery_log, wake_push_outbox, wake_push_subscriptions.
- The `authenticated` and `service_role` grants are not touched.
- Verify afterwards: `has_table_privilege('anon', ...)` is false for all of them. Then load the signed-out pages and check there are no errors, and confirm the signed-in dashboard still loads.
