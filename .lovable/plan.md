# Wake alarm: no coins or XP at/after 07:30 (server reward check only)

## What I checked (live database, this turn)
- Wake rewards are given by two server functions: `wake_finalize_solve` (online solve, also used by Shake/Typing/Tiles missions and the I'M AWAKE flow) and `wake_finalize_offline` (phone-solved offline claims via `wake_claim_offline`).
- Both call `axen_award_completion_coins` for coins and insert a `score_events` row (`wake_verified`) for XP. Streak, alarm session, wake task completion and next-alarm scheduling run in the same function.
- The old `complete_wake_protocol` is already disabled (always refuses), so it gives no rewards today.
- Every alarm firing row stores its own `timezone` (copied from the user's saved alarm timezone when the firing was created on the server) and `local_date`. All 47 rows have both, all valid timezones. This is the trusted timezone source; no client value is read.

## Change (one new migration, function bodies only)
In both functions, add one server-side check:

```text
cutoff = (firing local_date + 07:30:00) in the firing's stored timezone
late   = now() >= cutoff        -- server clock only
```

- If `late`: reward result becomes `after_cutoff`, coins = 0, and the `wake_verified` XP row is not inserted.
- If not late: everything is exactly as today (same tiers 10/7/5/3, same 30/35-minute windows, same daily-claim rule).
- No early return: the solve is still marked, streak, alarm session (with 0 coins), wake task completion, next alarm scheduling, push cancel and delivery log all still run.
- Offline path uses server `now()`, not the phone's solved time. Effect: an offline solve sent to the server after 07:30 earns 0 even if the user solved it earlier.

Not touched: tables, columns, RLS, policies, grants, schema, `axen_award_completion_coins`, tier functions, `wake_claim_offline`, Math/Science, any other feature or UI.

## Verification
- Read the replaced function definitions back from the database.
- Add a small test beside existing wake tests asserting both functions contain the cutoff and gate coins and XP.
- No test accounts, no user data changes.

## Not implemented by this change
- The alarm will still ring, and can still be solved, after 07:30; it just gives 0. Stopping the ringing at 07:30 needs a separate app change you'd have to approve.
- Alarm times 07:30–07:59 can still be saved; any solve of them gives 0.
