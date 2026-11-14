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

## Additions (your 7 points)

**What I found about the old plan tools**
- `create_plan_draft` builds a plan and stores it as a "draft" in the coach's plan store (`coach_plans`). `confirm_plan` marks it confirmed and copies today's tasks into your Home task list (`tasks`). Nothing goes to a My Plan page, and there is no single list of dated tasks.

**One clear path**
- `save_plan` becomes the only way to save. `confirm_plan` is removed from the coach's tool list (text and voice). `create_plan_draft` stays only to suggest a preview, limited to 1 or 7 days.
- So Home keeps working, `save_plan` also records the plan as confirmed in the old store and adds today's tasks to Home, using the same existing code. Prompt lines about confirm_plan are rewritten to say "call save_plan"; no second save method is mentioned anywhere.

**Safe saving**
- Delete + insert run in one database function in a single transaction, so a failure leaves your old plan untouched.

**Dates**
- Every text request and the voice token request send the phone's timezone and local date. "Today" and date checks use that timezone (server UTC is never used). Allowed: today up to 7 days ahead.

**Security**
- The user id comes only from the verified session, never from tool arguments. All plan reads/writes use the user's own signed-in connection so row rules apply. No admin access is used for plans.

**Toasts**
- Text and voice both show "Plan saved ✅ (N tasks)" with a "View" button to /my-plan, based on the real save result (live update as backup, shown once). Red toast on failure.

**Voice**
- The voice token request sends date, timezone and the new tools, all baked into the token; each fresh session and reconnect gets a new token with them.

**Final report** will list what wasn't tested (voice on a real phone) and anything you must do by hand.

## Final additions
- `create_plan_draft` is also removed from the text and voice tool lists. The coach describes a preview in chat, then calls `save_plan`. The prompt says nothing is saved until save_plan succeeds.
- Home sync replaces today's coach tasks and never adds them twice. Success or failure depends only on the plan_tasks write. If the Home or old-store sync fails, that is logged and the true plan_tasks result is still reported.
- The database function runs with the caller's permissions (security invoker) and takes the user from `auth.uid()` inside, never from an input.
- In voice, save_plan is a blocking call, so the coach waits for the result before talking about it.
- If asked for more than 7 days, the coach says it plans 7 days at a time and offers to do the next week afterwards.
