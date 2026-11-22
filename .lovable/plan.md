# Restore AXEN to the exact look from before the "5 tasks" prompt

## Deep check result (verified this turn)
- Baseline = the last version before the 5-task prompt (491d44f, "Show Coach plan items only in My Plan").
- Since then only 7 files changed, and **none of them is a design, icon, layout, colour or screen file**:
  - `src/lib/theme/theme.tsx`: the default theme. The accidental Publish shipped "Simple (white) by default", which made the app look completely changed. It is already put back to Dark by default in the preview.
  - `GoalHabitPicker.tsx`, `dashboard.tsx`, `ProfileDetailScreens.tsx`: only the "Home holds 5 habits" error text (kept, as you asked).
  - `task-limit.ts`: that message text. `coach-tools.ts`: Coach no longer copies plans to Home (requested earlier). `types.ts`: auto-generated.
- No icons, screens, styles or features were removed. Your screenshots (black, lime, gold coins, violet cards, All Ranks, My Journey, wake sheets) match the current Dark code.
- Live site: the styles file loads (HTTP 200 on axonhabit.app). The Android app opens axonhabit.app, so it shows whatever was last published, which is still the white-default build.

## Fix
1. Publish the current version. This sends Dark-by-default to the live site and the Android app. No code revert is needed: reverting to the baseline would bring back the white Simple default.
2. On your phone: Home → Command Center → Appearance → tap **Dark** once. The phone already saved "Simple" from the accidental build, and a saved choice always wins.
3. Theme tap bug (separate request): reproduce it with touch taps at 390px first, then fix it only in `AppearanceSwitcher.tsx` / `theme.tsx` if a real cause shows up.

## Not touched
Database, 5-habit limit, rewards, Coach/My Plan, Accountability, nudges, wake.
