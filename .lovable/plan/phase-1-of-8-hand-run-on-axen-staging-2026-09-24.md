# Phase 1 of 8: hand-run on AXEN Staging

This workspace can't pass the gate by itself. It's on Lovable's editing branch `edit/edt-c1f3d75e-…`, and the only database I can change is the LIVE one, `nfmgiczlthezfwgsazfc`. So you run all SQL in your staging SQL Editor, and I review every result. I never run SQL on live.

## Steps
1. **Check the target.** In the staging dashboard, make sure the project ref is **not** `nfmgiczlthezfwgsazfc`. If it is, stop.
2. **Baseline.** Run `AXEN_STAGING_BASELINE_FORWARD.sql` once, then `AXEN_STAGING_BASELINE_VERIFICATION.sql`. Send me both outputs. If anything errors, stop and paste the error. Don't retry and don't run the rollback.
3. **Step A: reconciliation (my side).** From the verification output, I sort each required object into one of five groups: exists and compatible, needs an additive fix, missing, duplicate or conflicting, or can't verify. The objects are the 8 Phase 1 tables, the `contract_status` type, score_events and its idempotency key, coin_transactions, profiles, goals, and the reward and privileged functions. I also check the grants, access rules, indexes, triggers and links on each one. I confirm that score_events and coin_transactions are reused, with no new ledger. If anything is a duplicate, a conflict, or can't be verified, I stop.
4. **Step B: review.** I show you the one forward-only Phase 1 migration (already prepared, with your corrections), updated for anything step 3 finds, along with its rollback file. **You approve before it's run.**
5. **Apply and test on staging.** You run the Phase 1 forward file, then the tests file, then a read-only schema check. The tests use two test accounts on staging and cover the 16 required cases. Send me the outputs.
6. **Report.** I give the full final report: branch and ref, what was reused and created, the fixes, filenames, the access and privilege matrix, test results, schema check, regression check, and rollback. Then I give the verdict: **PHASE 1 PASSED** or **PHASE 1 BLOCKED**.
7. **Commit.** The Phase 1 files and the regenerated types are saved as one commit on Lovable's editing branch. You bring it into `feature/verified-discipline` on GitHub yourself. I don't merge or deploy anything.

## Limits
- I can't regenerate types from staging. They get updated by hand from the staging schema output, and I'll flag that in the report.
- Nothing touches production, main, the UI, or Phase 2.

Next action once you approve: step 1. You run the baseline and send me the verification output.
