# Plan: native Android alarms (Part A) + access-rule fixes (Part B)

# Part A: Native alarm notifications

## What you get
On the installed Android app, every active alarm (4AM Protocol / Wake alarm) is scheduled on the phone itself. It rings with a long alarm sound, vibrates and shows on the lock screen even when the app is closed or the phone is locked. Tapping it opens the existing alarm screen, where the Math/Science/mission challenge works exactly as it does today, and coins are still awarded only by the server. The website and the preview behave exactly as before.

## How it works
1. **Permissions**: the first time you save or enable an alarm on Android, the app asks for notification permission. It then checks exact-alarm permission with checkExactNotificationSetting. If that's off, the app shows a short explanation and opens the system setting with changeExactNotificationSetting.
2. **Channel "alarms"**: importance max, vibration on, lock-screen visibility public, and a custom sound `axen_alarm` (an original 35-second alarm tone added to the app's sound files).
3. **Scheduling**: each alarm uses fixed notification IDs made from its alarm ID. For repeating alarms, there's one weekly-repeating notification per selected weekday (on: weekday, hour, minute, allowWhileIdle). A single (non-repeat) alarm uses one notification at its next fire time.
4. **Resync**: on every app open/resume and after every save, edit, enable or disable, the app cancels all "alarms" notifications it owns and schedules them again from the server's alarm list. This also covers time-zone changes and reboots (the plugin reschedules after boot).
5. **Cancel**: if an alarm is disabled or deleted, its notifications are removed on the next sync, which runs right after the change.
6. Existing reminders (habit reminders) keep their current behaviour and ID range. Alarm IDs use a separate range so they never collide.

## Files to change
- package.json: pin `@capacitor/local-notifications` to ^7. It's currently ^8, which doesn't match Capacitor core 7 and would crash the native build.
- New: src/lib/native-alarms.ts holds permissions, the channel, building the schedule from alarm rows (pure helper), and sync/cancel.
- New: tests/native-alarms.test.ts covers the repeat-day → weekday mapping, non-repeat next time, stable IDs, and disabled alarms producing no notifications.
- src/components/WakeProtocol.tsx: call sync after save/enable/disable (one line each, no UI change).
- src/routes/_authenticated/dashboard.tsx (or the existing app root observer src/components/wake/WakeObserver.tsx): sync on app open/resume, native only.
- android/app/src/main/AndroidManifest.xml: add POST_NOTIFICATIONS, SCHEDULE_EXACT_ALARM, USE_FULL_SCREEN_INTENT, RECEIVE_BOOT_COMPLETED, VIBRATE, WAKE_LOCK.
- New: android/app/src/main/res/raw/axen_alarm.wav (generated, original sound).
- ANDROID_BUILD.md: a note to run `npx cap sync android` and rebuild.

## Limits to know
- This needs a new Android build uploaded to the Play Store. The live website can't do it.
- Android notification sounds play once per notification. A 35-second tone gives a long ring, but it won't loop endlessly like the built-in clock app. Ringing forever would need a custom native alarm service, which is out of scope.
- Some phone makers (Xiaomi, Oppo, Vivo) may still delay alarms unless battery optimisation is off for AXEN.
- I can't test on a real phone from here.
- Play Store: apps using SCHEDULE_EXACT_ALARM must declare that alarm is a core feature in the Play Console.

# Part B: Access-rule (RLS) audit and proposed fixes

## Results (read-only, live database)

All 65 app tables (public) have RLS on. No app table has an anon or public policy. Every policy on user data checks auth.uid(), except the cases listed below.

| Table | RLS | Policies (command: condition) | Verdict |
|---|---|---|---|
| 8 server-only tables: alarm_events, daily_coin_decay, nudge_suggestion_log, wake_delivery_log, wake_push_outbox, wake_push_subscriptions, wake_question_history, wake_typing_sentences | On | none, so the app is locked out | Safe |
| billing_plans | On | ALL for service_role: true | Safe (server-only role) |
| payment_events, subscriptions | On | ALL for service_role: auth.uid() IS NULL OR owner; plus owner SELECT | Safe (server-only role) |
| billing_notifications | On | SELECT: false | Safe |
| nudge_templates | On | SELECT: active | Safe (shared, non-personal text) |
| quiz_questions | On | SELECT: is_active AND NOT wake_only | Safe (shared content) |
| coach_messages | On | DELETE: owner, and DELETE: false; UPDATE: false; INSERT/SELECT: owner | Risky: the two DELETE rules combine with OR, so users can still delete their own coach history |
| partner_messages | On | SELECT: sender or recipient | Risky (low): no active-partnership check. The table is unused and empty |
| coach_memory, coach_plan_materialized, coach_plans, coach_profile, daily_coin_decay, nudge_templates, plan_tasks | On | owner-only policies | Risky (low): leftover anon table grants. RLS still blocks them, but this goes against defense in depth |
| All other public tables (about 50) | On | authenticated, owner or partner via auth.uid() | Safe |
| storage.objects: avatars, proofs (both private) | On | owner folder = auth.uid(); proofs partner read needs a matching proof row | Safe |
| 4 database_export_* buckets | private | no policies, so the app is locked out | Safe |
| auth.*, vault.secrets, realtime partitions, drizzle/supabase_migrations | Off | system-managed, no anon access | Safe (managed, not changed) |
| cron.job, cron.job_run_details, realtime.messages, storage.* | On | platform-managed | Safe (managed, not changed) |

Open tables: none.

## Fixes I would apply (one migration, waits for your approval)

1. coach_messages: drop the permissive "owner can delete" policy, so the existing DELETE false rule takes effect. Users can no longer delete coach history from the app. Confirm first that no screen offers deleting a conversation. If one does, keep the policy and mark this as accepted.
2. partner_messages: change SELECT to (sender or recipient) AND is_active_partner(other party). It's unused today, so nothing visible changes.
3. Revoke all privileges from anon on the 7 tables listed above. Signed-out users never used them, so nothing visible changes.

No changes to auth, storage, cron, realtime or other system schemas.

## Technical details

- Rollback: recreate the dropped policy, the old partner_messages policy, and GRANT the same privileges back to anon.
- Check after applying: rerun the anon-privilege and pg_policies queries, then load Coach and Accountability as a signed-in user.
