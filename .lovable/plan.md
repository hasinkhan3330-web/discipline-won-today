# Fix: make the staging baseline re-runnable on a non-empty staging database

## What happened
- The FORWARD file's safety guard stopped because `public.profiles` already exists in staging, so staging already has some or all of the AXEN schema.
- Adding `CREATE TABLE IF NOT EXISTS` alone is not enough: the file also has `CREATE POLICY`, `CREATE TRIGGER`, `CREATE INDEX` and `ALTER TABLE ... ADD COLUMN`, which fail on re-run, and `IF NOT EXISTS` can hide a table whose columns differ.

## Plan
1. **Inventory (read-only):** you run `AXEN_STAGING_INVENTORY.sql` (already delivered, SELECT-only) in the staging SQL Editor and paste the output.
2. **Rebuild as `AXEN_STAGING_BASELINE_FORWARD_V2.sql`** (original file stays untouched):
   - Tables: `CREATE TABLE IF NOT EXISTS` + `ADD COLUMN IF NOT EXISTS` for every column.
   - Functions: `CREATE OR REPLACE FUNCTION`.
   - Triggers and policies: `DROP ... IF EXISTS` then `CREATE` with identical definitions (converges, no RLS weakening).
   - Indexes/constraints: `IF NOT EXISTS` / existence-checked DO blocks.
   - Views: `CREATE OR REPLACE VIEW`.
   - Same statement order and definitions. Guard no longer aborts because tables exist; any column/type mismatch found in the inventory is flagged in comments and reported, not silently hidden.
   - No DROP TABLE, TRUNCATE, DELETE, or data copying.
3. **You run** FORWARD_V2 once in staging, then the unchanged VERIFICATION file, and send both outputs.
4. **I report** the dependency checklist (profiles, goals, tasks, score_events, coin_transactions, leaderboard view, RLS policies, helper functions/triggers) and READY FOR PHASE 1 or BLOCKED.

## Safety
- File generation only; I execute no SQL.
- Confirm the staging ref is not `nfmgiczlthezfwgsazfc` before running.
- No UI, routes, app code, or production changes.
- On any error: stop, no retry, no rollback, paste the exact error.
