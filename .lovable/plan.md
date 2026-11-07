# AXEN Coach v2 upgrade (additive only)

Goal: when a new user opens AXEN, the Coach learns about them (target ~70–90% of key details) through a short, personal chat, then builds and starts their day plan. Everything else in AXEN stays exactly as it is.

## What stays untouched
Home, Zen, Rank, Stats, Accountability, You tabs, bottom nav, theme, auth, subscriptions, coins/XP/rank/seal rules, existing tasks and existing Coach chat history. The Coach screen keeps its current look; only its brain and a small "Your plan" card are added.

## What the user will experience
1. **Getting to know you (onboarding):** Coach asks one question at a time, in Hindi / Hinglish / English, never repeating anything already known (it first reads the user's existing profile, habits and history). Vague answers get 2–3 options. A small "Coach knows you: 64%" bar shows progress.
2. **Summary + length:** at ~70%+ it says "Toh main samjha: …", asks if right, then 7 / 21 / 90 days.
3. **Plan draft:** max 3 tasks/day in week 1, each with a trigger and a 2-minute minimum version, one distraction fix, lighter review days. User can say "change X"; nothing is saved until a clear yes.
4. **Plan starts today:** on yes, today's tasks are added to the user's normal habit list (same coins rules as existing tasks — easy/medium/hard use current amounts, no new rewards).
5. **Daily coaching:** morning top task, evening check-in, no-shame missed-day help, reset after 2 missed days, weekly review every 7 days. Coach can add, edit, reschedule — never marks anything done.
6. **Memory:** Coach remembers wins, failure patterns and preferences across sessions.
7. **Safety:** habit coach only, gentle for under-18, care + helpline message on distress.

## Technical details
- New tables (additive, owner-only RLS, no anon): `coach_profile` (slots JSON with per-slot confidence, onboarding_done, coach_style, age_range), `coach_plans` (draft/confirmed JSON, days, start date). Reuse existing `coach_notes` for memory (types win / failure_pattern / preference / weekly_review).
- `src/utils/coach.functions.ts`: replace the system prompt with the v2 prompt from your pack and add tool calling via the AI gateway: `get_user_context` (profile, last 10 memories, weekly summary, real progress from existing reads in `coach-context.functions.ts`), `update_profile`, `create_plan_draft` (second model call with the v2 plan prompt + self-check, validated with a schema: ≤3 tasks wk1, minutes ≤ available time), `confirm_plan`, `update_task`, `reschedule_tasks`, `save_coach_memory`, `get_progress`. All run server-side as the signed-in user; no tool can complete a task or award coins.
- Plan-generation model and provider live in one config constant (e.g. `COACH_PLAN_MODEL = { provider, model }` in a small server-only config module); the function logic reads only that constant, so it can be switched later without touching code paths. No provider is hardcoded inside `create_plan_draft`.
- Confirmed plan inserts rows into the existing `tasks` table using the current insert path, so economy guards stay in charge.
- `VoiceCoach` live session gets the same v2 prompt text; no UI redesign.
- UI additions only inside Coach: confidence bar, plan draft card with Accept / Change buttons.
- Tests: rule tests (≤3 tasks/day week 1, total minutes ≤ available, every task has minimum version, coach cannot mark done, other users can't read profile/plan) plus a scripted run of the 10 personas from your pack with replies saved for review.

## Not possible / honest limits
- The Coach can only "know" what the user tells it or what AXEN already stores; it cannot read the phone or other apps.
- Plan quality depends on the AI; the persona test is how we check it, and I'll show you the replies.
