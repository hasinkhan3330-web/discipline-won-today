# Real Android phone test: 07:30 alarm cutoff (no code changes)

This is only a test guide. Nothing in the app will change. The cutoff is in the code (commit c2159f1), but it has **not** been tested on a real phone yet. I will only call it device-tested after you send me your result.

## Before you start
1. Install an Android build made **after** the latest alarm change. The old APK on your phone does not have the cutoff. Rebuild and install it, or update from Play Store when the new version is there.
2. Phone settings for AXEN: Notifications ON, "Alarms & reminders" ON, Battery set to "Unrestricted", phone not on silent/Do Not Disturb (or allow AXEN through it).
3. Check the phone clock and timezone are set to automatic (the cutoff uses the phone's local 07:30).

## Test 1: alarm at 07:29, app closed, phone locked
1. Night before or early morning: open AXEN → You → 4AM Protocol. Make a new alarm for **07:29**, Repeat Daily ON. Save it.
2. Keep AXEN open for 10 seconds. This is when it schedules the phone alarms.
3. Close AXEN fully (swipe it away from recent apps) and lock the phone. Do not open it again.
4. **07:29:00** – expected: alarm notification rings/vibrates.
5. Do not touch the phone. Write down the exact time the sound and vibration stop.
6. **07:30:00 to 07:35** – expected: **no new ring and no vibration**. (Before the change, it rang again every minute until about 07:59.)
7. At 07:36 open AXEN – expected: it opens Home, **not** the alarm/mission screen.
8. Check coins – expected: **0 coins** for this alarm.
9. Next morning – expected: the 07:29 alarm rings again (Repeat Daily still works).

## Test 2: alarm screen open at 07:30
1. Set an alarm for 07:29, let it ring, tap it so the mission screen opens. Do not solve.
2. At **07:30:00** – expected: sound and vibration stop within about 1–2 seconds and the screen goes back to Home.

## Test 3: before cutoff still works (control)
1. Set an alarm for 07:25 and solve the mission at about 07:27.
2. Expected: normal rewards, same as before.

## 07:29:59 question – honest answer
- **App closed:** an alarm notification that already started at 07:29 (or 07:29:59) plays its sound **one time until that sound file ends**. Android controls this; the app is not running and cannot cut it mid-sound. It may continue for a few seconds after 07:30. No **new** ring will start after 07:30.
- **App open on the mission screen:** sound and vibration stop at 07:30:00, within about 1–2 seconds.
- If you set an alarm at 07:30 or later, it will not ring at all.

## Send me back
- Phone model and Android version
- Exact time the sound/vibration stopped in Test 1
- Any ring or vibration after 07:30 (yes/no, time)
- Did the app open Home or the alarm screen at 07:36
- Coins after the test
- Did it ring again the next day

After the test, delete the temporary alarm or turn it off, so it does not wake you every day.

## Limits
- iPhone: no native closed-app alarm exists in this app, so Test 1 can't be done on iPhone.
- If the phone time or timezone is changed by hand, the phone's ring cutoff follows the phone clock. Coins still follow the server.
