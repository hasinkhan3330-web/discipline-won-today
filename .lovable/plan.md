# Hide Coach plan items from Home

## What changes
Coach-made items stay in My Plan (Today / 7 Days) only. Home "Today Missions" and the "x/12" counter show only tasks you added yourself. No data is deleted.

## How coach items are identified (existing data, no DB change)
Every Home task the Coach creates is already recorded in the existing `coach_plan_materialized` table (`task_id` column). Owner-only read access already exists. Manual tasks never appear there.

## Steps
1. Home (`src/routes/_authenticated/dashboard.tsx`): stop calling the coach "add today's plan tasks to Home" step on load, so no new coach rows are created in Home.
2. Same file: also read the user's `coach_plan_materialized.task_id` list and filter those ids out of the loaded tasks before they feed Today Missions, the counter and the progress totals. This hides existing coach items without deleting them.
3. Coach `save_plan` (`src/lib/coach-tools.ts`): skip the Home mirror (`syncHome`) so new plans only write to My Plan (`plan_tasks`). My Plan reading is unchanged.

## Not changed
Manual tasks, My Plan screen, Coach chat, rewards, database schema and existing rows.

## Check
Typecheck/build, and Home in the preview: manual tasks still listed, counter excludes coach items.
