# Accountability Batch 3: Focus garden, Proof history, Recovery + audit of all 8 screens

Only the Accountability screens inside the You tab. No change to backend, tables, RLS, auth, routes, scoring/garden/streak/trust/Recovery logic, coins, achievements, bottom nav, other tabs or global CSS. No new query, RPC, table or dependency. Dark + Simple, existing tokens, copy meaning kept. Nothing is saved, sent or submitted on your account while checking, and no test accounts.

## Files
- `src/components/verified/acct/AcctScreens.tsx`: `GardenScreen` look only
- `src/components/verified/acct/AcctUI.tsx`: new SVG `Tree` (5 stages), `StageRow`, `Switch`, `ScoreRules`
- `src/components/verified/AccountabilitySection.tsx`: only the `proofs` and `recovery` view blocks, and passing the current pact into New pact for Reschedule prefill
- `src/components/verified/acct/acct.module.css`: new classes only
- Audit fixes stay inside these same files

## Real data only (what the existing data does and doesn't give)
- **Garden:** stage, stage name, score (0–100), points to next stage, pacts due, resting. The bar shows score with a mono pill (e.g. "0 / 20" = score / next stage threshold from points_to_next). One status line only.
- **Partner tree:** only stage + name exist, no score. Partner card shows their SVG tree, stage name and a violet stage row; **no partner progress bar** (hidden, no data).
- **Proof history:** each row has type, time, review status and reviewed time. There is **no thumbnail, pact name or category** in the current load, so those are hidden. Cards show a proof-type icon, type, time and the existing status as a lime mono pill.
- **Filter chips All / Confirmed / Pending** map to existing statuses only (Confirmed = confirmed; Pending = awaiting review/self-reported). Filtering happens on screen over the same 10 loaded rows.
- **Recovery:** Comeback availability uses the same existing condition (missed + no recovery yet). Status chips: Available / Used / Not needed; Reschedule: Always available.

## Screen 6: Focus garden
- Hero card in the contract style (violet glow + dot grid), soft lime glow behind the tree.
- 5 new inline SVG trees (Seed, Sapling, Young, Lush, Ancient) with soil mound, gradients and a gentle sway; sway off with reduced motion. The new trees also replace the small ones on Accountability Home (same component).
- Neon lime bar + lime mono number pill + one status line (duplicated "Finish one pact…" removed).
- Stage row like the Rank stage scroller: current stage white with lime "Current" pill, reached stages normal, later stages muted with a lock-in-circle.
- Collapsible "How your score works": 3 small neon bars for the same rules (85% on-time pacts, Recovered counts 60%, 15% check-in days) plus "−10 per overdue pact". Text only, no math change.
- Partner tree card in violet; "Show my tree to my partner" becomes a lime switch with helper text, same save as now.

## Screen 7: Proof history
- Empty: large lime outline icon, one line on what counts as proof, lime "Start a session" button (goes to the existing Accountability Home pact card, no new action).
- Filled: Stats-style timeline cards + filter chips as above.
- Lock-icon note "Your partner sees only proof you submit".

## Screen 8: Recovery
- Same supportive copy. "15-minute Comeback" and "Reschedule" as two Rank-style cards with status chips and one line on when each unlocks; Pause/Resume row stays.
- "Recovered counts 60%" as a lime mono pill + small bar.
- Reschedule opens New pact prefilled with the current pact's title, category, minutes and evidence (form fields only; you still press Save yourself).

## Final audit (all 8 screens)
- Compare card radius, border, icon tiles, pills, fonts, rings and buttons with Stats/Home; fix mismatches inside the Accountability files only.
- WCAG AA contrast in Dark and Simple, aria-labels on icon buttons, visible focus rings, no layout shift, no console errors, no sideways scroll at 360/390/414px, nothing hidden behind the bottom nav.
- Checked in a test browser with every save/send request blocked. Empty/filled/error states of Proof history use mocked data in the test browser only.

## Report
Files changed, what passed, what could not be tested, and confirmation that no backend, scoring/streak logic, data shapes or other tabs changed. Then stop.
