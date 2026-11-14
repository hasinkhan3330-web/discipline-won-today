# Coach plans that really save: plan_tasks + My Plan page

## What exists today
- Text Coach calls the normal Gemini API through a server function; Voice Coach uses a Gemini Live session whose setup (system prompt, tools) is built on the server and baked into a short-lived token. Both share one tool set and every tool call runs on the server as the signed-in user.
- Sign-in already exists (email + Google), so no auth work is needed.
- The coach already has plan tools (`create_plan_draft`, `confirm_plan`). Those stay. Two new tools are added next to them.

## 1. Database
- New table `plan_tasks` with the columns you listed, indexed on (user_id, task_date). The user id is a plain id (project rule: only profiles and roles link to the auth table directly).
- Users can only read, add, change and delete their own rows. Live updates switched on.

## 2. Coach tools (text and voice)
- `save_plan(plan_title, tasks[])`: checks dates, titles and durations (max 7 days, max 4 tasks per day), removes the user's not-completed tasks on those dates, adds the new ones, and returns `{success, saved_count}` or `{success:false, error}`.
- `get_plan(from_date, to_date)`: returns the user's rows.
- Both run on the server as the signed-in user, always send back an answer (even on error), and log the call, its inputs and the result.

## 3. Coach instructions (added, not replaced)
- Today's date and timezone from the phone at session start (and on voice reconnect).
- Must call save_plan to make or change a plan, and never says "saved" unless it worked. Calls get_plan before answering "what's my task today/this week".
- At most 2 short questions, then build the plan: today = 1 day, week = 7 days, 1-4 measurable tasks per day with minutes, then a 2-line summary ending with "open My Plan".

## 4. My Plan page
- New signed-in page `/my-plan` with "Today" and "7 Days" tabs, loading, empty ("No plan yet – talk to your coach") and error states. Ticking a task saves it. Updates live.
- "My Plan" link added on the Coach screen (no change to the bottom menu, which stays as it is). Toasts: "Plan saved ✅ (N tasks)" or a red error.
- Styled with existing tokens, so it works in Dark and Simple.

## 5. Self-test
- Unit tests for save_plan checks (bad dates, empty title, too many tasks).
- In a test browser: ask the text Coach for a 7-day plan, check the rows, open My Plan, reload, sign in again, and check that another account can't see them. A real voice session on a phone can't be tested here.

## Technical details
- Files: migration, `src/lib/coach-tools.ts` (defs + `runCoachTool`), `coach-voice-tools.ts`, the Coach system prompt builders, new `src/utils/plan-tasks.functions.ts`, `src/routes/_authenticated/my-plan.tsx`, the Coach screen link, tests.
- Nothing to switch on by hand.
