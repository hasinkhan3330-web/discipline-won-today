# Accountability redesign — Batch 1 (Home screen + ⋯ menu)

Only the Accountability ("You" tab) changes. Home Command Center, the other tabs, the bottom menu, data, logic, coins and copy stay as they are.

## Screen 1 — Accountability Home
- One header: title "Accountability", short muted line under it, a round ⋯ button and the existing coin pill on the right. Remove the second back arrow.
- Week strip: 7 rounded tiles (Stats "This Week" style). Today glows lime, missed days show a coral dot, a small violet corner dot when the partner finished. Tap a day to show only that day's pacts.
- Today card (like Home "Today's Discipline"): big "done/total", thick lime ring, two cells: your streak | next deadline. When empty: 3 quick pills (Study 30 min, Workout 20 min, Read 15 min) that pre-fill New pact, plus a lime "Create a pact" button and an outlined "Check in" button. With pacts: the next pact due, with a live countdown.
- The 3 empty rings become 3 small stat cards: Pair streak (flame, days, 7 dots), Pending (pulses only if more than 0), Trust (level name + step meter, tap opens the existing explainer).
- Garden card: your tree (lime glow) and partner's tree (violet glow) side by side, stage, progress bar, "N pts to Sapling" pill. Tap opens the garden.
- Partner card: photo with status ring, name, "Partner since…", status pill, cheer/nudge buttons (existing Hinglish texts, word for word).
- Check-ins / Proof history / Recovery rows in the Rank mini-card style, with value pill and chevron.
- "+ New pact" floating button: shown only after the main button scrolls out of view, sits above the bottom menu, never covers Recovery. Remove the empty space at the bottom.
- Loading skeletons, empty and error states. Animations respect reduced motion.

## Screen 2 — ⋯ menu (bottom sheet)
- Groups: REPORTS (Weekly report), APPEARANCE (the same Dark/Simple switch as Home → Command Center, same label), PRIVACY (Show my tree / Share my pact progress / Mute nudges as lime switches with a one-line hint), DANGER ZONE in coral (Remove partner, Block & report, each with a confirm box explaining what happens).

## Colors
Me/done = lime, partner = violet, coins = gold, missed = coral, pending = dim lime. All blue removed. Both Dark and Simple themes.

## Technical details
- Files: `src/components/verified/AccountabilitySection.tsx` (home + menu markup only), `acct/AcctUI.tsx` (WeekStrip, ring, new StatTile/Switch/SectionHeader), `acct/acct.module.css` (scoped tokens on screen root for Dark and `[data-theme=simple]`; violet, coral, dim-lime added here, not globally, per the Accountability-only styles rule).
- Reuse existing handlers: `toggleTheme`, `saveShowTree`, `setPref`, `endPartner(block)`, `setView`, nudge RPC. Template pills pass prefill props to `PactCreator` (initial values only; validation unchanged).
- Day filter and FAB visibility (IntersectionObserver) are local UI state only.
- No database, RPC, route or dependency changes. Other sub-screens (New pact form, Check-in, Garden, Report) wait for Batch 2/3.
- Verify at 360/390/414 px in Dark and Simple, no console errors, typecheck/build clean.
