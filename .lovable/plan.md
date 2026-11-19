# Phase 3 follow-up: rolled-back test for check-in, details and commitment

## Step 1 (needs build mode; one transaction that rolls back, so nothing is saved)
On one existing active partner pair, acting as partner A:
- A: `send_accountability_nudge(conn,'details',null)` → expect OK plus the details JSON
- B: `send_accountability_nudge(conn,'commitment','Gym 6am')` → expect OK
- C: `checkin` before any task is done today → expect "complete a task first" (unchanged rule)
- D: add one temporary task completion for today, then `checkin` → expect OK
- E: `checkin` again → expect "already checked in today"
- F: count new `partner_events` rows → expect 0 (check-ins are not logged as nudges)
The block ends with RAISE EXCEPTION, which rolls back everything, including the temporary task completion. No real sends, no test accounts.

## Then STOP
Report max 8 lines plus raw output.
