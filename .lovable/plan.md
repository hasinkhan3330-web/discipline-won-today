# Wake alarm: add Shake, Typing, Find Color Tiles missions

The workspace is in plan mode, so this is the full build plan for one pass. Math and Science stay exactly as they are.

## What exists today
- One alarm per user ("AXEN Wake Protocol"). The mission is stored as `alarms.challenge_type`, and only `math` or `science` is allowed. That rule is enforced in two places: the save function's input check and the `wake_save_settings` server check. Difficulty is `wake_difficulty` 1–3.
- Ringing: `wake_get_state` turns a due event into "ringing" and issues a private question. `AlarmScreen` loops the sound and vibration and restores itself after a reload. Only `wake_submit_answer` can mark an event solved. Solving runs the shared finalizer: reward window, coins, streak, next occurrence, push cancel.
- There is no "Off" mission in the data. "Off" will map to the existing alarm on/off switch.

## What gets built
1. **Picker (mission step only):** Math, Science, Shake, Typing, Find Color Tiles and Off rows, in the colors and sizes you specified, with a "New" chip as in your screenshot. Tapping a new mission opens a bottom sheet with a chip, your headline, a CSS/SVG demo, a coral "Next" button and a "Try it" button. If the phone has no motion sensor, the Shake row shows "Not supported on this device" and can't be picked.
2. **Per-alarm settings for the new missions:** Easy/Normal/Hard (default Normal) and Rounds 1/2/3 (default 1), with "Try it" here too.
3. **Shake:** a meter that fills as you shake. It uses a low-pass filter and peak detection at thresholds of 11/14/18 m/s², with peaks at least 150 ms apart, at most 7 per second, and targets of 20/40/70. Progress never goes down. iOS asks for motion permission on a tap. If motion access is lost, a "Motion access needed" screen appears and the alarm keeps ringing. Finishing shows a flash, then a check mark and a short vibration.
4. **Typing:** a sentence card with muted, white and red letters, plus a progress bar and a round counter. Easy and Normal ignore case; Hard is case-sensitive with punctuation. Paste, drop and cut are blocked, as is any single input that adds more than 2 characters. The sentence bank holds 60+ original sentences per difficulty in English and in Hinglish (Hindi in Roman letters), and never repeats the last 5 used.
5. **Find Color Tiles:** grids of 4x4, 5x5 and 6x6 with 3–4, 5–6 and 8–10 targets. Each round picks a random colour-blind-safe color pair, and Hard uses closer shades. Tapping a target pops it. A wrong tap shakes and flashes red, and 3 wrong taps make a new layout. Each round ends with "All clear!" and the last one with a green check mark.
6. **Same ringing and completion path:** the new missions render inside the existing `AlarmScreen`, with the same sound loop, vibration, reload restore and no close button. Wake lock, visibilitychange and portrait lock work the same way. A finished mission calls one new server function, which runs the same finalizer as solving a question.
7. **Preview mode ("Try it"):** runs on the device only, with no sound and no server calls. It records nothing and gives no coins, and you can close it.

## Technical details
- Additive migration:
  - Allow `shake`, `typing` and `tiles` in `wake_save_settings`.
  - Add `alarms.wake_mission_rounds smallint default 1`.
  - Add `wake_complete_mission(_event_id, _proof jsonb)`. It is SECURITY DEFINER, owner-only, ringing-only and idempotent, and refuses math/science events. It needs a minimum time since the first ring based on difficulty × rounds (for example Easy 1 round ≥ 8 s), plus a 400 ms rate limit.
  - Move the shared finalizer into a private helper. The existing `wake_submit_answer` body stays byte-for-byte unchanged; only the new function uses the helper. Existing rows are never edited.
- `wake_get_state` / `wake_event_payload` gain `mission` and `rounds`, and skip issuing a question for the new missions.
- New files: `src/lib/wake-missions/{shake,typing,tiles,sentences}.ts` (pure logic) and `src/components/wake/missions/*` with a scoped CSS module.
- Edited files: the picker in the wake settings UI, `AlarmScreen.tsx` (a branch that picks which mission to show only), `wake.functions.ts`, `wake-types.ts`.
- Tests: shake streams (walking noise, hard shakes, rate limit, exactly 100%); typing (paste/dictation blocked, case rules, completion); tiles (exactly N unique targets, reset after 3 wrong taps); a live server test (completes exactly once, a second call pays nothing, too-early completion refused, cannot complete math via the new function); the ringing screen has no dismiss while unfinished; the picker shows 5 missions and disables Shake; all existing wake tests rerun unchanged.

## Assumptions and risks
- Shake, typing and tile results are measured on the phone, so the server can only check timing and ownership. A modified phone could fake a finish. Rewards follow the existing wake rules unchanged.
- Closed-app ringing still has the existing browser limits, and backup alerts remain inactive. I will report only what I actually test.
- No Household Hunt or AI mission, and no changes outside the alarm.
