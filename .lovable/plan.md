## Prerequisites for the two missing partner functions (read-only report)

Nothing was run or changed.

**Where the functions come from**
- `acct_pact_advance(uuid)` and `acct_cofocus_advance(uuid)` don't come from an earlier step. They're created inside the Phase 2 SQL itself (lines 62 and 344 of `axen-phase2-accountability.sql`).
- They don't exist yet because Phase 2 hasn't been run. That's expected.

**What must already be in place (all confirmed present)**
- Phase 1 tables: all 7 exist (pact stakes, disputes, trust events, co-focus sessions, recovery choices, partner messages, commitment reminders).
- The 3 new contract fields: all present (done criteria, fallback action, deadline).
- The partner-check helper `acct_is_party`: present.
- The background job tool (pg_cron 1.6.4): installed.

**Conclusion**
- No other prerequisite migration is needed. Running the Phase 2 file as one unit creates both functions, plus the helpers they rely on, in the right order.
- Phase 2 stays skipped until you approve it.
