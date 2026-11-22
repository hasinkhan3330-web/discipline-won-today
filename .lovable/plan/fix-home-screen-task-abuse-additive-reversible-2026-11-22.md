# Fix Home-screen task abuse (additive, reversible)

## Step 1 findings (read-only, already run)
- Coach registry = `coach_plan_materialized` (id, user_id, plan_id, day_index, task_index, local_day, task_id nullable, created_at).
- ACL: `authenticated=arwdDxtm` (full). Policies: own INSERT, SELECT, UPDATE; no DELETE policy. A user can insert/edit registry rows today → must be locked.
- 109 registry rows → 84 distinct linked tasks (some rows share/lack task_id); 7 of those tasks are still active on Home.
- 8 non-registry tasks have Coach-looking names (study/physics/revision/session) — report only, never changed by title.
- 12 users have >5 active personal Home tasks (max 12).
- `tasks` has no archive column; `enforce_task_limit` counts all active tasks, limit 12, no lock.
- task_completions writers: `complete_task`, `complete_top_task`, `wake_submit_answer`, `wake_finalize_solve`, `wake_finalize_offline`; guard trigger `protect_task_completion_rewards` (`protect_verified_reward_fields`); clients have SELECT only.
- Coin writers include `axen_award_completion_coins` (50/day room), `complete_task`, award/wake/focus/streak functions.
- Consistent enough to proceed; the duplicate/null registry rows will be listed raw before the migration.

## Step 2 — one migration
a) `REVOKE INSERT, UPDATE, DELETE` on registry from authenticated/anon; drop own insert/update policies. Coach server code writes via service role only (check `coach-tools.ts` first; Home mirror is already disabled).
b) Add nullable `tasks.archived_at timestamptz`, `tasks.archived_reason text`, `tasks.archived_prev_active boolean`. Archive active registry-linked tasks: save `is_active` into `archived_prev_active`, set `is_active=false`, reason `coach_legacy`.
c) Per user, archive active personal tasks beyond newest 5 (by created_at), reason `over_limit`. No deletes.
d) Rewrite `enforce_task_limit`: `pg_advisory_xact_lock(hashtext(user_id))`, count active, `archived_at IS NULL`, not in registry; ≥5 → `RAISE 'Home task limit reached (5). Archive or delete a task to add a new one.'`. Also fire on UPDATE OF is_active/archived_at (reactivation can't bypass). Same trigger covers app, MCP and direct inserts.
e) `complete_task`: reject if task is in registry or `archived_at IS NOT NULL`, before any write. Add the same check to `protect_verified_reward_fields` for task_completions rows with a task_id.
f) Show `axen_award_completion_coins` cap source; loop test proves ≤50/day.

## Step 3 — rolled-back tests (BEGIN…ROLLBACK, `set role authenticated` + jwt claims of owner's account, no account creation)
All 9 listed cases; MCP path tested as the same `complete_task`/insert SQL it calls. Before/after counts of task_completions and coin_transactions.

## Frontend
Home "Build my habit": when 5 active tasks, show clear message and map the DB error text to a toast instead of silent fail. No other UI changes.

## Not touched
My Plan, plan_tasks, Discipline, reward amounts, any deletes.

## Rollback SQL (provided after apply)
Restore `is_active = archived_prev_active` where archived_reason in (...), clear columns, restore old function bodies and registry grants/policies.

## Report
Max 8 lines + raw functions, test output, ACLs, rollback SQL, untested list. STOP.

## Approved additions
1. Frontend: every Home "x/12" counter and cap text becomes 5. My Plan untouched.
2. Limit trigger fires only on INSERT, or UPDATE where NEW.is_active AND NEW.archived_at IS NULL AND NOT OLD.is_active; excludes the row itself; lock via `pg_advisory_xact_lock(hashtext(NEW.user_id::text))`; created after steps b and c in the migration.
3. New check in `protect_verified_reward_fields` runs on INSERT only. Report whether archived tasks are referenced by wake/alarm/discipline tables. Rolled-back test: `complete_top_task` and `wake_*` still work for a normal personal task.
4. Before revoking registry writes: grep app code and server functions for registry writes as a signed-in user; switch any to service role first.
5. Rollback order: restore old `enforce_task_limit` first, then `is_active`. Rollback itself tested in a rolled-back transaction.
6. Extra tests: reactivating an archived task past 5 via UPDATE rejected; archived-task completion via direct insert rejected.
7. Concurrency (two simultaneous inserts) reported NOT tested if it can't be exercised.

Assumption: keep 5 per user ranked by latest completion, then newest created_at; Coach-looking non-registry tasks stay untouched.

## Final additions
8. Pre-apply: grep app code, server/edge functions and SQL functions for every insert into `tasks` (onboarding, wake, MCP, coach, seed). Any path creating >5 at once or hitting the limit is listed and fixed or exempted. Rolled-back new-user onboarding test.
9. Pre-apply dry-run: per-user counts (no names) of coach_legacy and over_limit archives. Post-apply: same counts plus proof that archived_prev_active is set on every archived row.
10. Step c keeps the 5 tasks with the most recent completion (task_completions), falling back to newest created_at.
