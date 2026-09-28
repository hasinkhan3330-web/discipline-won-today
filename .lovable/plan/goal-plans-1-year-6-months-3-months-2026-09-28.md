# Goal Plans: 1 Year / 6 Months / 3 Months

Additive only. Colors, fonts, layout, target date, linked habits, and the edit and delete icons stay exactly as they are.

## What you will see
- **Add Goal:** a new row with 3 pill buttons in the current AXEN style:
  - 1 Year · 18,000 coins · 90% Success Guarantee (selected by default)
  - 6 Months · 9,000 coins · 90% Success Guarantee
  - 3 Months · 4,500 coins · 90% Success Guarantee
- One line below the pills: "Earn [X] coins in [plan] → AXEN guarantees 90% success in any field". (Your text says "Lowable"; I'll use "AXEN" unless you want "Lowable".)
- **Goal cards:** the bar and the "0 / 18,000 coins" text now show each goal's own target (18,000, 9,000 or 4,500).
- Bars never go backward. If you stop earning, the bar stays where it is. When you earn again, it keeps filling from that point.
- Goals you already have stay on the 1 Year plan (18,000 coins), so nothing changes for them.
- A goal's plan is chosen when you create it. When you edit a goal, its plan is shown but can't be changed. That stops anyone switching to a smaller target to finish faster.

## Technical details
- Migration (additive):
  - Add a `goals.plan_duration` text column, NOT NULL, default `'1_year'`, limited to `1_year`, `6_month` or `3_month`. Existing rows get `1_year`.
  - `goals.coin_target` is not needed because `target_coins` already exists. It will be set by the server from the plan (18000/9000/4500) and never taken from the app.
  - Update the goal guard trigger. On insert, set `target_coins` from `plan_duration`. On update, lock `plan_duration`, `target_coins` and `earned_coins`.
  - `recalc_goal`: use `g.target_coins` in place of the hardcoded 18000, and set `earned_coins = greatest(g.earned_coins, _earned)` so the bar never moves back. Progress is `least(100, earned*100/target)`, and completion happens at the target.
  - `save_goal`: add an optional `_plan_duration text default '1_year'` parameter, used only when a goal is created. The old call keeps working. Execute stays authenticated-only with a pinned search_path.
- `src/lib/economy.ts`: add `GOAL_PLANS` (key, label, target, duration text). Keep `GOAL_TARGET_COINS` as the 1-year default.
- `src/tabs/ProfileDetailScreens.tsx`: add plan pills to the add form and pass `_plan_duration`. On the goal card, replace `GOAL_TARGET_COINS` with `goal.target_coins || 18000` in the bar, the text and the slider max.
- Coach goal text already reads `target_coins`, so no change is needed there.
- Untouched: coin rewards, the daily cap, ranks, badges, streaks, other tabs, and navigation.
- Checks: a new goal on each plan gets the right target; old goals stay at 18,000; removing a linked habit doesn't lower the bar; the app can't change a goal's plan or target; the bar fills to 100% and completes at the target; build is clean.
