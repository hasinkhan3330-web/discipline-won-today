# Accountability Batch 3: Focus garden, Proof history, Recovery + audit

Only the Accountability screens inside the You tab. Display only: no change to backend, scoring, garden formula, streak/trust, Recovery logic, coins, data shapes, routes, bottom nav or other tabs. Dark + Simple, existing tokens.

## Where the existing data differs from the brief
- **Proof history** loads only: proof type, time, partner review status, reviewed time, review note (your last 10 proofs). It has **no photo/thumbnail, no pact name and no category**. Following the real-data rule, the cards will show status chip, proof type and time only; thumbnail, pact name and category icon are hidden.
- **Partner tree** gives only stage number + stage name, **no score/progress**. The partner card shows the stage and the stage row in violet, with no progress bar.
- **Garden progress "0 / 20"** is shown as current score / (score + points to next stage), both from existing garden data. Nothing is recalculated.
- **Reschedule prefill** uses the existing New pact preset (title, minutes, category) from today's pact. If there is no pact, it opens empty as today.
- **Batch 2 (screens 3–5) is not built yet**, because you asked me to wait. The final audit of "all 8 screens" covers spacing, contrast, focus, labels, scroll and the bottom nav on screens 3–5, without restyling them. See the open question.

## Files
- `src/components/verified/acct/AcctScreens.tsx`: `GardenScreen` only
- `src/components/verified/acct/AcctUI.tsx`: new `Tree` SVG art for the 5 stages (same props), small `StageRow`
- `src/components/verified/AccountabilitySection.tsx`: `proofs` and `recovery` view blocks only
- `src/components/verified/acct/acct.module.css`: new classes

## Screen 6: Focus garden
- Contract-style hero card (violet glow + dot grid), tree with soft lime glow.
- 5 new inline SVG trees (Seed, Sapling, Young, Lush, Ancient): soil mound, gradients, gentle sway (off with reduced motion). Same `Tree` component, so Home's garden card picks it up too.
- Neon lime bar + lime mono pill "score / next". One status line: resting message if resting, otherwise the due line (the duplicate sentence is removed).
- Stage row like Rank: current stage white + lime "Current" pill, earlier stages normal, later stages muted with a lock in a circle.
- Collapsible "How your score works": 3 small neon bars showing the same text rules (85% pacts on time, Recovered 60%, 15% check-in days, −10 per overdue pact). No math.
- Partner card in violet; "Show my tree to my partner" becomes the existing lime `Switch` with helper text, calling the same save.

## Screen 7: Proof history
- Empty: large lime outline icon, one line on what counts as proof, lime "Start a session" button. This only goes back to Accountability Home, where the existing Start button is. It does not start anything by itself.
- Filled: timeline cards (status as lime mono pill, proof type, time, "Reviewed" when reviewed) + filter chips All / Confirmed / Pending, grouped from the existing statuses.
- Lock-icon privacy note: "Your partner sees only proof you submit."

## Screen 8: Recovery
- Same supportive copy.
- "15-minute Comeback" and "Reschedule" as two Rank-style cards, status chips from the existing conditions (Available / Used for this pact / Not needed), and one line on when each unlocks. Pause/Resume stays as is.
- "Recovered counts 60%" lime mono pill + small static bar.
- Same `comeback()` and pause handlers; Reschedule opens New pact with the prefill above.

## Final audit
Radius, border, icon tiles, pills, fonts and buttons match Stats/Home; AA contrast in both themes; aria-labels on icon buttons; visible focus rings; no layout shift; no console errors; no horizontal scroll at 360/390/414; nothing hidden behind the bottom nav.

## Verification rules
Your real account only, read-only: only opening screens and taking screenshots. No session start, comeback, pause, pact save, proof, nudge, cheer or visibility toggle, and no test accounts. The filled Proof-history state and garden stages are checked with sample data shown only in the test browser (nothing stored).

## Ends with
A short summary confirming no backend, scoring/streak/garden/recovery logic, data shapes or other tabs changed.
