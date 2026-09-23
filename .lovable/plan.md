# Phase 1 on AXEN Staging: apply the migration and run security tests

## Important limit
My database migration tool only connects to the backend this project already uses, and that is your live one. It cannot reach an outside staging project. A publishable (anon) key also cannot create tables or change security rules, by design. So I cannot apply the migration to staging myself without touching production, and I will not ask for a service_role key or database password.

## Plan
1. **Connect staging (preview only).** Collect the staging URL and anon key through secure forms. Add a staging client that only runs in preview when you turn it on (`?staging=1`), with a "STAGING BACKEND" badge. Production stays untouched.
2. **Verify the target.** Confirm that the staging project ref is different from the live one (`nfmgiczlthezfwgsazfc`). If they match, STOP.
3. **Hand over the migration.** Save the corrected, forward-only Phase 1 SQL as one complete file, plus a separate rollback file. You paste the migration into the SQL editor of your staging project and run it there.
4. **Run the real security tests against staging** (anon key plus two test accounts you sign up on staging):
   - Anon users can't read or write any Phase 1 table.
   - User A can't read, update or delete User B's contracts, sessions, proofs, recovery records or partner links.
   - Clients can't set reward, completion, recovery or server-only fields, can't skip states, and can't forge session evidence.
   - Sessions can't be deleted (they're append-only), and each user gets one contract per local day.
   - You can't link a goal you don't own, and repeat reward calls don't pay out twice.
   - Privileged functions can't be run by anon or PUBLIC.
   - Existing AXEN features still work: profile, tasks, coins and leaderboard reads.
5. **Report PASS or BLOCKED** with the real results. Save Phase 1 as its own checkpoint and stop before Phase 2.

## What this does NOT do
- It never runs a migration on the live backend or changes production data.
- It never requests a service_role key, database password or access token.
- It makes no UI or theme changes, and doesn't touch main or production settings.

## Needs from you
- Your staging project must already have the existing AXEN schema. Phase 1 depends on profiles, goals, score_events and coin_transactions.
- You run step 3 in staging yourself.
