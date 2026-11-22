# Home limit: strictly 5 active tasks (defaults included)

## Findings (read-only, this turn)
- `wake_submit_answer`, `wake_finalize_solve` and `wake_finalize_offline` find the user's Wake task by name in `tasks`. No wake or alarm table has a foreign key to `tasks`.
- Dry run: 27 users have active Home tasks; 17 extra tasks would be archived when the Wake task is always kept and the other slots go to the most recently completed tasks.
- Signup already creates 5 default habits, so after this change every new user starts at 5/5 and must delete one before adding their own (shown with the new message).

## Migration (one, additive)
1. Archive the extras, as before: save `archived_prev_active`, set `is_active=false`, `archived_reason='over_limit_v2'`, no deletes. For each user, keep the active task that wake/alarm functions use (name matches wake) first, then the latest completion, then the newest created. Coach-registry rows are already archived and not counted.
2. Run step 1 before replacing the trigger function, so the migration's own archiving can't trip it.
3. `enforce_task_limit`: remove the defaults exemption. The count becomes all active, non-archived, non-Coach tasks, excluding the row itself. Keep the per-user advisory lock and the same insert/reactivate conditions. Raise the same message at 5 or more.
4. `complete_task` and the guard trigger stay unchanged.

## Rolled-back tests (real owner account, BEGIN..ROLLBACK)
- Inside the transaction, free today's coin cap by moving that account's coin_transactions created today to yesterday. The rows aren't deleted, and everything is rolled back.
- Archive one active task to make room, add a personal task and run complete_task: it should award the normal coins (pts clamp 1–5) plus streak/score, with values shown before and after.
- Check-in: temporarily reactivate a revoked connection, move today's completions to yesterday first so "no task done" is refused, then refused → complete → allowed.
- The 6th active task is rejected (insert and reactivate).
- Rehearse the rollback SQL in a rolled-back transaction.

## Frontend
- `taskLimitMessage` copy becomes: "Home holds 5 habits, including the defaults. Delete one to add a new habit." The Home counter already shows done/total, which is at most 5.

## Rollback SQL
Restore the previous `enforce_task_limit` (with the defaults exemption) first, then `UPDATE tasks SET is_active=archived_prev_active, archived_at=NULL, archived_reason=NULL, archived_prev_active=NULL WHERE archived_reason='over_limit_v2'`.

## Report
Max 8 lines + raw functions, test output, rollback SQL, untested list. STOP.
