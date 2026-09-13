# Rebuild the Stats screen from the supplied reference

## Goal
Reproduce the reference’s mobile Stats composition as closely as practical while keeping every displayed value connected to the signed-in user’s existing AXEN data.

## What will change
- Replace the current segmented Stats/Calendar layout with the single continuous reference layout.
- Add the large Stats header and subtitle, live coin pill, weekly chart, discipline score ring, KPI tiles, seven-day consistency, focus/discipline progress, and streak milestones.
- Keep the existing six-item bottom navigation unchanged, with Stats selected.
- Match the reference’s dark indigo surfaces, purple glow, fine borders, icon treatment, spacing, typography hierarchy, and mobile proportions.
- Add restrained chart/ring/progress animation with reduced-motion support.

## Live data mapping
- Coin pill: current profile coin balance.
- Weekly chart and seven-day row: existing seven-day completion percentages.
- Discipline score: calculated from the existing weekly completion data.
- Best streak, lifetime coins, and meditation: existing profile/completion/meditation values.
- Focus time: total minutes from the user’s logged focus sessions.
- Mindful habits and milestone state: existing habit completion and streak data.
- Use clear zero states where history does not exist; no invented user statistics.

## Technical details
- Extend the Stats props and dashboard data query only where needed for focus minutes and current coin/streak values.
- Build the chart and score ring with lightweight inline SVG/CSS, avoiding a new dependency.
- Scope the new visual tokens and animations to the Stats screen so other tabs are unaffected.
- Preserve current app navigation, account access, task completion updates, and mobile safe areas.

## Validation
- Run the TypeScript check and production build.
- Compare the signed-in Stats screen at the supplied 360×645 mobile viewport and a wider mobile viewport.
- Verify the chart, live values, scrolling, and selected bottom-navigation state without overlap or console errors.
