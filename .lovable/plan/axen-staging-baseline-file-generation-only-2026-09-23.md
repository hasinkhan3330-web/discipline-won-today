# AXEN Staging Baseline — File Generation Only

## Connected project
- Connected backend ref: `nfmgiczlthezfwgsazfc` — **LIVE**. Nothing will be run against it.
- No SQL will run anywhere. This task only creates files.

## Evidence found (read-only)
- 63 migration files in `supabase/migrations/` (2026-07-24 → 2026-09-21), applied to the live backend in order. These are the most reliable record of the current setup.
- 31 tables: profiles, goals, goal_habits, tasks, task_completions, score_events, coin_transactions, daily_top_tasks, focus_sessions, alarms, alarm_sessions, habit_reminders, friendships, accountability_pacts, pact_nudges, streak_shield_uses, unlock_rewards, vision_verifications, quiz_questions, quiz_attempts, first_launch_assessments, coach_conversations, coach_messages, coach_notes, coach_sessions, app_trials, entitlements, subscriptions, billing_plans, billing_notifications, payment_events.
- Also checked: generated `src/integrations/supabase/types.ts`, every `.rpc(` / `.from(` call in `src/`, and the server functions that call reward RPCs.

## Approach
Build the baseline by **replaying the 63 migrations in order**, then compare the result with `types.ts` and a read-only snapshot of the live catalog (list tables, columns, policies, functions only; no data read, nothing written). This avoids guessing: every object comes from an applied migration.
- Leave out migration steps that write data (seeding quiz questions, billing plans, backfills). These go in a separate list and are included only if they are reference data the app needs, never user data.
- Leave out Phase 1 objects (none exist in migrations).
- Anything that only exists outside migrations, like Storage buckets, auth settings, and the Cloud-managed `auth.users` triggers, goes under "MISSING / CANNOT RECONSTRUCT SAFELY".

## Deliverables (written to Files, `/mnt/documents/axen-staging-baseline/`)
1. `AXEN_STAGING_BASELINE_FORWARD.sql`: one forward-only script, grouped as extensions/enums → tables → constraints/FKs → indexes → functions (empty `search_path` kept as defined) → triggers → RLS → policies → grants. It opens with a guard that stops the run if the target database name or URL matches the live project where detectable. No DROP/TRUNCATE/DELETE.
2. `AXEN_STAGING_BASELINE_ROLLBACK.sql`: marked for staging only. Removes exactly those objects in reverse order and never touches `auth.users`.
3. `AXEN_STAGING_BASELINE_AUDIT.md`: live-ref statement, "NO SQL EXECUTED", files inspected, full object inventory, dependency map, RLS matrix, missing items, manual steps, and "Do not proceed to Phase 1 until the baseline runs successfully in staging."
4. `AXEN_STAGING_BASELINE_VERIFICATION.sql`: read-only catalog queries (information_schema/pg_catalog) that report each missing table, column, policy, index, trigger, or function.

## Checks before delivery
- Grep all four files for banned statements (the rollback is exempt from DROP only).
- Parse the forward file for syntax with a local Postgres parser (offline, no database connection). Report this only as a syntax check, not as tested.

## Stop
Once the files are delivered, stop. No apply, no Phase 1. Wait for your staging SQL Editor result.
