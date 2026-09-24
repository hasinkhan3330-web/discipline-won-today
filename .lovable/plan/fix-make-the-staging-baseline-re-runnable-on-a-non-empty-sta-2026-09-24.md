# Fix: make the staging baseline re-runnable on a non-empty staging database

## What happened
- The FORWARD file's safety guard stopped the run because `public.profiles` already exists in staging.
- That means staging is not empty — some or all of the AXEN schema is already there.
- The current FORWARD file (a replay of all 63 original migrations) uses bare `CREATE TABLE`, `CREATE POLICY`, `CREATE TRIGGER`, etc., which fail when objects already exist.

## The problem with a simple fix
- Adding `CREATE TABLE IF NOT EXISTS` alone is not enough: the file also has `CREATE POLICY`, `CREATE TRIGGER`, `CREATE INDEX`, `CREATE TYPE`, and `ALTER TABLE ... ADD COLUMN` statements, each of which can fail on re-run, and `IF NOT EXISTS` can silently hide a column-level mismatch (e.g. a table exists but with different columns).

## Plan
1. **Inspect first (read-only):** ask you to run a short read-only inventory query in the staging SQL Editor listing existing tables, columns, functions, triggers, and policies. This tells us exactly what staging already has, so the fixed file matches reality instead of guessing.
   - The query will be provided as a small new file `AXEN_STAGING_INVENTORY.sql` (SELECT-only, no changes).
2. **Rebuild the FORWARD file idempotently** based on the inventory result:
   - Tables: `CREATE TABLE IF NOT EXISTS`, plus column-presence checks (`ADD COLUMN IF NOT EXISTS` / DO-blocks) where a live column could be missing.
   - Functions: `CREATE OR REPLACE FUNCTION` (safe for functions; preserves signatures).
   - Triggers: guarded with `DROP TRIGGER IF EXISTS` + `CREATE TRIGGER` (or DO-block existence checks) so re-runs don't duplicate or fail.
   - Policies: `DROP POLICY IF EXISTS` + `CREATE POLICY` (policy text is identical to live, so replace is safe and converges).
   - Indexes / types: `IF NOT EXISTS` guards.
   - Keep the original statement order and exact definitions — no schema redesign, no weakening of RLS.
   - Keep the abort-if-live guard, but change it to abort only when the target is confirmed live (ref check), not merely because tables exist.
3. **Deliver the rebuilt file** as `AXEN_STAGING_BASELINE_FORWARD_V2.sql` (a new file; the original stays untouched for reference), plus keep the existing VERIFICATION file (unchanged, still read-only).
4. **You run it:** FORWARD_V2 once in the staging SQL Editor, then VERIFICATION, then send me both outputs.
5. **I verify and report** the dependency checklist (profiles, goals, tasks, score_events, coin_transactions, leaderboard view, RLS policies, helper functions/triggers) and issue READY FOR PHASE 1 or BLOCKED.

## Safety
- No SQL executed by me at any point — file generation only.
- Nothing touches production; you run everything by hand in staging after confirming the ref is not `nfmgiczlthezfwgsazfc`.
- No production/user data is copied; no UI, routes, or app code changes.
- If any run errors: stop, no retry, no rollback — paste the exact error.
