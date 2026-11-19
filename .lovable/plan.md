# Phase 3 tweak: emergency skips the hourly limit

## Change (one migration, send_nudge only)
- Hourly check runs only when the template is not emergency:
  `IF _t.category <> 'emergency' AND (SELECT count(*) ... interval '1 hour') >= 3 THEN RAISE 'hourly nudge limit'`
- Everything else identical: emergency 1 per 24h, 30-min same-template, 10 per 24h, hard 2 per 24h, mute, active partner, owner postgres, SECURITY DEFINER, search_path=public, ACL unchanged (no GRANT/REVOKE).
- Emergencies still count toward the hourly total of normal nudges (counting query unchanged).
- send_accountability_nudge not touched.

## Rolled-back test (one real pair, BEGIN ... ROLLBACK)
1. Normal nudge A -> OK
2. Normal nudge B -> OK
3. Normal nudge C -> OK
4. Normal nudge D -> ERR hourly nudge limit
5. Emergency #1 -> OK (no timestamp shifting)
6. Emergency #2 -> ERR emergency limit
7. Confirm 0 rows remain after rollback

## Report
Max 8 lines, then raw text of send_nudge and send_accountability_nudge (post-change), ACLs, test output. Stop.

## Rollback SQL
Recreate send_nudge with the current hourly line (no category condition).
