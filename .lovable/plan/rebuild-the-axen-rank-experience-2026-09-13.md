# Rebuild the AXEN Rank experience

## Goal
Replace only the Rank tab with the supplied reference composition, preserving the existing six-tab navigation and live AXEN data while making every visible control functional.

## Rank screen
- Reproduce the reference structure and proportions: profile strip, coin pill, Discipline Rising rank card, four metric cards, Daily Motivation, rank progression, current-rank rewards, XP earning guide, and unchanged bottom navigation.
- Use the reference’s dark navy glass panels, lime highlights, purple/blue/gold/orange rank tones, borders, typography hierarchy, compact spacing, icon treatment, and subtle glow.
- Change only “Exclusive avatar decoration” to “Exclusive Theme Unlock”.
- Populate coins, streak, completion rate, XP, level, current rank, progress, and reward states from the signed-in user’s existing profile and activity data.

## Working interactions
- Open focused detail panels from Current Streak, Total Coins, Completion Rate, and Best Rank.
- Open Daily Motivation in a smooth sheet with deterministic daily rotating content.
- Open the full seven-rank progression from “View All Ranks”; every rank explains its XP range and live locked/current/unlocked state.
- Make every reward item open a live requirement/progress panel.
- Make every XP earning row navigate to the relevant existing app area or open a useful explanation when no separate destination exists.

## Rewards and themes
- Drive unlocks from the real coin balance: 5,000 unlocks an Exclusive Theme, 10,000 unlocks a premium theme/reward, and 20,000 unlocks a distinct Legend-level theme.
- Persist the selected unlocked theme, apply it through the existing app-wide theme/wallpaper system, and prevent locked themes from being selected.
- Show exact required coins and current progress for locked rewards; show Unlocked and an Apply/Applied action after unlocking.
- Add a one-time polished unlock celebration when the user crosses a reward threshold, with reduced-motion support.

## Integration and validation
- Keep Home, Rank, Zen, Coach, Stats, and You navigation unchanged and ensure Rank remains selected on the Rank screen.
- Preserve existing authentication, subscriptions, streak/coin updates, and other tabs.
- Test all Rank cards, reward/rank items, motivation sheet, theme application, close/back actions, and bottom navigation at 360×645 and a wider phone size.
- Run the TypeScript check and production build.
