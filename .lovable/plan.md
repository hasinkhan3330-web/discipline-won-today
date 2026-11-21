# Coach: no hour limits, "Plan my tomorrow" chip, working top icons

Only the Coach changes. Nothing else in AXEN is touched.

## 1. No hour limits
What I found that cuts or refuses your hours:
- Coach instructions say "If the plan is too heavy for their time, say so and cut it" and "Total minutes per day <= daily_time_available".
- Plan saving rejects any task over 480 minutes (8h).
- The plan builder caps every task at 240 minutes and drops tasks once the day passes your saved "time per day" (max 600).
- Saving allows only 4 tasks per day, so 18h split into sessions with breaks would be rejected.

Changes:
- Rewrite those instructions: use the exact hours you give, never reduce, refuse, lecture or swap your numbers; long blocks may be split into sessions with short breaks, but the study time adds up to exactly what you asked. Applies to one-day plans, multi-day plans and single-day edits, for both text and voice Coach.
- Remove the 480-minute limit (keep only "a whole number of at least 1 minute").
- Remove the 240-minute task cap and the daily-budget drop in the plan builder.
- Raise the tasks-per-day limit so session splits fit (up to 12 per day).
- Your "time per day" setting becomes a hint for plans where you didn't state hours, never a cap.

## 2. "Plan my tomorrow" chip
- Replace "Plan my next 7 days" with "Plan my tomorrow" on the Coach screen (and the older text-coach starter list).
- Tapping it sends a message asking for a plan for tomorrow only; the Coach already gets today's date in your timezone, and the instructions will say "tomorrow" = one day, today + 1.

## 3. Calendar and keyboard icons
- The code already wires them (calendar → My Plan, keyboard → text chat), so the cause is something on the page, likely an element covering the top bar or the bottom-sheet layer. First step: a touch-tap test at phone size to find exactly what intercepts the tap.
- Fix that cause, enlarge both buttons to 44px, make sure nothing invisible sits above them, and keep plain tap handlers (no hover/desktop-only events).
- Verify with real touch taps in the browser at 360/390px, in Dark and Simple; the Android app uses the same page, so the same fix applies there (a phone check stays with you).

## Technical details
- `src/lib/coach-tools.ts`: prompt lines 50, 61, 66; `save_plan` description ("1-4 tasks per day").
- `src/lib/coach-voice-tools.ts`: same wording if duplicated.
- `src/lib/plan-tasks.ts`: drop `mins > 480`; `MAX_TASKS_PER_DAY` 4 → 12.
- `src/lib/coach-plan-rules.ts` `enforcePlanRules`: remove `Math.min(240)` and budget skip; `maxTasksForDay` raised to match.
- DB `save_plan_tasks` has no duration check (confirmed in 0038), so no migration.
- `CoachOrbScreen.tsx` CHIPS, `AiCoach.tsx` STARTERS; `.kb` in the orb CSS module → 44px; fix the overlay found by an elementFromPoint/touch Playwright check.
- Update existing plan-rule tests for the new limits; add one test that a 360-minute task saves unchanged.
