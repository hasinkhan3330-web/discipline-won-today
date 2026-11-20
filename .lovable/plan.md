# Plan: native Android alarms (Part A) + access-rule fixes 2 and 3 (Part B)

# Part A: Native alarms (Android only)

## Behaviour
1. **Permissions**: when an alarm is saved or enabled on Android, the app asks for notification permission, then runs checkExactNotificationSetting. If exact alarms are off, it shows a short explanation and calls changeExactNotificationSetting.
2. **Channel "alarms"**: importance max, vibration on, lock-screen visibility public, custom 35-second sound `axen_alarm`.
3. **Scheduling**: the main notification for each selected weekday repeats weekly. A non-repeat alarm gets one notification at its next fire time. IDs are stable and derived from the alarm ID, in a range separate from habit reminders.
4. **Ring until solved**: each alarm firing also gets 30 follow-up notifications, one per minute for 30 minutes after it fires, on the same channel, sound and vibration. Their IDs are stable and linked to that alarm and that firing. They're cancelled only after the server confirms a correct solve (`response.solved`), for Math, Science, Typing/Text or Colors/Tiles. A wrong answer, a swipe or opening the app doesn't cancel them. Follow-ups are scheduled ahead of time, so they still ring even if the app never opens.
5. **Resync** on every app open/resume and after every save, edit, enable or disable: the app cancels only its own alarm IDs and reschedules from the server alarm list. Follow-ups for a firing that's ringing right now and not yet solved are kept. A disabled or deleted alarm loses all of its notifications.
6. **Alarm screen** (opened from the notification): the sound loops and Capacitor Haptics vibrates continuously until the server confirms a correct answer. A wrong answer keeps ringing and shows a retry or new question, which is the existing behaviour. Sound, vibration and follow-ups stop only on a correct answer.
7. **Tap opens the alarm**: a `localNotificationActionPerformed` listener is registered once at app start, in the root app shell, before sign-in screens load. Every alarm notification carries `extra: { kind: "alarm", alarmId }`. The plugin also keeps the tap that launched a closed or killed app and delivers it when the listener registers, so the app always opens /alarm for that alarm. If sign-in is still loading, it waits for the session and then opens /alarm.
8. **Two upcoming firings**: instead of weekly repeats, each active alarm gets one-time notifications for its next 2 firings. Each firing has 1 main and 30 follow-ups, so 62 per alarm (about 186 for 3 alarms), well under Android's limit of 500. Every app open, resume and save resyncs and tops up the window, so the next morning always has its full chain even if the app isn't opened for a day.
9. **Cap**: no more than 450 scheduled alarm notifications in total. Firings are sorted by time across all alarms and added nearest first, each with its main notification plus its follow-ups, until the cap is reached. Later firings are filled in on the next resync.
10. Coins and rewards are unchanged and stay server-only. The website and preview behave exactly as now. All logic is gated by `Capacitor.getPlatform() === "android"`, with no iOS code.

## Files to change
- package.json: pin `@capacitor/local-notifications` to ^7 (it's currently ^8, which doesn't match core 7), and add `@capacitor/haptics` ^7.
- New: src/lib/native-alarms.ts holds the platform check, permissions, channel, schedule builder, follow-ups, sync, cancel-on-solve and continuous haptics.
- New: tests/native-alarms.test.ts covers the next-2-firings calculation (repeat days and non-repeat), the tap payload → alarm route, weekday mapping, non-repeat next time, stable and non-colliding IDs, disabled alarms producing nothing, 30 follow-ups one minute apart, and cancel-on-solve hitting only that alarm.
- src/components/wake/AlarmScreen.tsx: on the server-confirmed solve (the two existing `response.solved` branches), stop haptics and cancel that alarm's follow-ups. While ringing, start native haptics alongside the existing looping sound. No UI change.
- src/components/WakeProtocol.tsx: sync after save, enable and disable.
- src/components/wake/WakeObserver.tsx: sync on app open/resume.
- android/app/src/main/AndroidManifest.xml: add POST_NOTIFICATIONS, SCHEDULE_EXACT_ALARM, RECEIVE_BOOT_COMPLETED, VIBRATE and WAKE_LOCK, without USE_FULL_SCREEN_INTENT.
- New: android/app/src/main/res/raw/axen_alarm.wav, an original generated 35-second tone.
- ANDROID_BUILD.md: a note to run `npx cap sync android` and rebuild.

## Limits
- This needs a new Play Store build, and the Play Console must declare alarm as a core feature for exact alarms.
- Each notification plays its 35-second sound once. The ring keeps going through the minute-by-minute follow-ups for 30 minutes, not endlessly.
- Some phone brands may delay alarms if battery optimisation is on.
- I can't test on a real phone from here.

# Part B: Access-rule fixes (fix 1 skipped)

One migration:
- partner_messages: SELECT is allowed only for the sender or recipient, and only while the other person is still an active partner (`is_active_partner`). The table is unused, so nothing visible changes.
- Revoke anon privileges on coach_memory, coach_plan_materialized, coach_plans, coach_profile, daily_coin_decay, nudge_templates and plan_tasks. RLS already blocked these, so nothing visible changes.
- The coach_messages delete rule is left as is.
- Files: one new migration under drizzle/migrations (created by the migration tool), and types.ts if it gets regenerated.
- Rollback: restore the old partner_messages policy and grant the same privileges back to anon.
