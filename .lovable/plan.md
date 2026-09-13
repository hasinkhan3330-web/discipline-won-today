# Upgrade the You and Stats experience

## Goal
Rebuild only the You/Profile and Stats areas as one cohesive premium cosmic discipline system, closely following the supplied references while preserving the existing six-tab navigation, authentication, Home behavior, rewards, subscriptions, and all other app features.

## You dashboard
- Replace the current segmented profile card with the full reference-style dashboard: cosmic profile header, avatar and username, “Discipline Seeker”, live coin pill, rank/level and XP panel, four live KPI cards, daily motivation, feature grid, weekly consistency, and the “Discipline Today = Freedom Tomorrow” footer panel.
- Derive Current Streak, Total Coins, Completion Rate, Best Rank, XP, weekly progress, and unlocked milestones from the signed-in user’s existing profile and completion history.
- Keep avatar upload, account/subscription tools, referral, and sign-out available from a clear account control without disrupting the reference composition.
- Make My Journey, Achievements, Statistics, Goals, Habits, and Reminders open real in-app detail screens with back navigation; retain the single bottom navigation and keep You selected except when Statistics switches to the existing Stats tab.

## Functional detail screens
- **Habits:** show three priority habits first, allow completing them through the same verified completion/reward flow used by Home, and add a “Build Any Habit” form with name, icon, frequency, duration, and coin reward. Saved habits appear immediately on Home, You, reminders, and Stats.
- **My Journey:** build a live timeline from task completions, streak history, focus/meditation totals, and earned milestones.
- **Achievements:** derive locked/unlocked states and progress for Day 1, 7, 21, 60, 90, 180, and 365 from the real longest streak and completion data.
- **Goals:** add persistent user-owned goals with title, progress, target date, edit, completion, and delete actions; dashboard summaries update immediately.
- **Reminders:** expand the existing persisted habit reminders into a full manager with create/edit, time, enable/disable, and delete controls; support linking reminders to either habits or goals.

## Stats
- Preserve the current reference-matched Stats composition and animations, while correcting every metric to use persisted data: weekly graph, discipline score, current/best streak, lifetime earned coins, meditation, focus time, weekly consistency, and milestones.
- Refresh Stats and You after habit completion, goal changes, and reminder changes so visible values stay synchronized without a reload.
- Keep Stats selected in the unchanged six-item bottom navigation whenever the Stats screen is open.

## Data changes
- Extend habits with recurrence and 21-day builder metadata while keeping existing tasks fully compatible.
- Add a user-owned goals table with strict access rules.
- Extend reminders so one reminder can target a habit or a goal, with database validation preventing invalid targets.
- Use the existing `complete_task` reward function for all habit completions so coins, streaks, completion history, Home, You, and Stats remain one source of truth.
- Include explicit authenticated/service grants and row-level access policies for every new or changed table.

## Visual system and motion
- Scope a shared You/Stats cosmic visual system to these experiences only: deep navy space field, neon blue/purple/magenta/gold accents, glass panels, luminous borders, compact mobile typography, and reference-matched proportions.
- Use subtle entrance, count-up, progress-fill, chart, press, and page-transition motion with reduced-motion support.
- Keep touch targets, safe areas, readable contrast, and smooth scrolling reliable at the supplied 360×645 viewport and wider phones.

## Validation
- Verify create/edit/complete/delete flows for habits, goals, and reminders with a signed-in session.
- Verify one habit completion updates Home, You, coins, streak, weekly consistency, Journey, Achievements, and Stats from the same persisted event.
- Compare You and Stats at 360×645 and a wider mobile viewport; confirm no overlap, clipped text, duplicate navigation, dead cards, console errors, or failed data requests.
- Run the TypeScript check and production build.
