# Accountability Batch 2: Daily check-in, New pact, Check-ins

Only the Accountability screens inside the You tab ("Home" = Accountability Home). No change to backend, RLS, auth, routes, scoring/streak/trust, coins, achievements, bottom nav, other tabs or global CSS. No new table, RPC or dependency. Dark + Simple, existing tokens, Hinglish texts word-for-word. Batch 3 waits for your go.

## Files
- `src/components/verified/acct/AcctScreens.tsx`: `CheckinScreen`, `PactCreator` (look only; `validatePact`, insert row, EVIDENCE, REMINDER_PREFS unchanged)
- `src/components/verified/acct/AcctUI.tsx`: new small pieces: `TimelineField` (01–04), `Segmented`, `StepperBar`, `StickyAction`, `DateTimePicker`, `MinutesStepper`
- `src/components/verified/AccountabilitySection.tsx`: only the `view === "partner"` (Check-ins) block, plus a confirm before the emergency nudge
- `src/components/verified/acct/acct.module.css`: new classes only
- `tests/acct-datetime.test.ts`: tests for the picker's time math (12 AM/PM, midnight crossing, Tomorrow, same output string as before)

## Where the existing code differs from the brief (no logic change, reported only)
- **Check-in:** today it can be saved with both answers on "No" by default. The new screen needs both answered before Save. The saved data (same table, same fields, true/false) is unchanged. This only adds a step on screen.
- **Check-in streak:** this screen has no check-in streak data, so there is no count-up.
- **Cheer "Sent":** the server only answers "sent" or "already sent today" after a tap. The Sent state shows after a tap in this visit; it isn't known in advance.
- **Partner's week:** only "streak · tasks" totals exist, no per-day values, so there is no bar chart.
- **Emergency nudge:** a confirm dialog is added before the same existing send. Nothing else about sending changes.

## Screen 3: Daily check-in
- Numbered timeline 01–04, mono uppercase labels, navy rounded inputs, "30 sec" chip. Same 4 fields.
- Yes/Not yet and Yes/I'm fine start unselected. If today's check-in is already saved, the saved answers show.
- Placeholders + counters (x/140). Save is a lime gradient pill, disabled with a reason below ("Answer both questions") until both are answered.
- After save: a short lime celebration + "Your partner will see this", then back as today.
- Partner today card (existing status call) + 3 cheer buttons with a Sent state and the existing toast.

## Screen 4: New pact (3 steps)
- 3-segment lime stepper in the header; sticky lime "Next →" bar above the bottom nav; when disabled, the reason sits right below it (step 1: title rule; step 3: `validatePact` message).
- Step 1: timeline fields with placeholders/examples; category chips with icons and capitals for the 7 existing categories; Today/Tomorrow segmented (same `pickDay` logic); custom Start and Deadline pickers ("Tue 17 Nov · 7:45 PM", 12-hour, +30m/+1h/+3h chips) that write the **same `toLocalInput` string** as the old native input; session length stepper ±5 with presets 15/25/30/45/60 (5–240 limits); live summary card ("30-min study · 7:45–10:45 PM"); inline error from `validatePact`.
- Step 2: same fields (minimum, If-Then, obstacles, evidence) in the timeline style.
- Step 3: same partner/visibility/reminder options, then a contract-style "REVIEW" card (title, time, length, evidence, partner/visibility, reminder) above Save.

## Screen 5: Check-ins
- Lime "Daily check-in" button; today's status for me (lime) and partner (violet) from the existing data (`checked_in_today`, partner check-in status).
- Partner's week: the existing "streak · tasks" line, styled.
- "Our contract" card: textarea, counter, Save only when changed, "Saved" state after the existing save; partner's text in a violet bubble.
- Nudges: the same 5 texts grouped Gentle / Push / Hard with icons, same send + toast. Emergency nudge: coral outline + alert icon + confirm dialog.
- "Aaj ka task kiya": clear action button with done/not-done states, same behaviour.
- Recent list and unread badge stay exactly as built.

## Verification (no saves on your account)
- At 360/390/414px, Dark + Simple: no horizontal scroll, no console errors, nothing under the bottom nav.
- Up to the final button only. In the test browser every save/send request (check-in, pact, cheer, nudge, emergency, contract) is blocked, so nothing reaches your partner. Nothing is created and there are no test accounts.
- The date/time math is checked with automated tests.
- Report what could not be tested, then stop.
