# Walkthrough: Run the AXEN Staging Baseline by Hand

You run this yourself in your staging project's SQL Editor. I cannot run it — my database tool only reaches your live project (`nfmgiczlthezfwgsazfc`), and the saved staging connection's publishable key cannot create tables or policies by design. Nothing is executed from here.

## Step 1 — Confirm you are in the right project (most important)

1. Open your Supabase dashboard and make sure you are looking at your **AXEN Staging** project, not the live one.
2. Check the project ref in the dashboard URL or Project Settings → General. It must **NOT** be `nfmgiczlthezfwgsazfc` — that is your live app.
3. If the ref matches `nfmgiczlthezfwgsazfc`, stop. You are in production.

## Step 2 — Run the forward baseline

1. In the staging project, open **SQL Editor** (left sidebar).
2. Click **New query**.
3. Open `AXEN_STAGING_BASELINE_FORWARD.sql` from the Files I gave you (the artifact in this chat — 4,247 lines, verified intact from the profiles table through the final 20260921013902 section), select **all** of it, and copy.
4. Paste into the SQL Editor and click **Run** (or Ctrl/Cmd + Enter). It should run once, as-is — do not edit, split, or re-run pieces.

**If it succeeds:** you'll see a success notice. Continue to Step 3.

**If it fails:**
- Stop. Do not re-run it, do not run the rollback file, and do not edit the SQL.
- Copy the full error message the editor shows and paste it here. Some statements may have partially applied; I'll tell you exactly how to recover (or when to use `AXEN_STAGING_BASELINE_ROLLBACK.sql`) based on the exact error.

## Step 3 — Run the verification queries

Only after Step 2 succeeds:

1. Open a fresh query tab in the same SQL Editor.
2. Copy the full contents of `AXEN_STAGING_BASELINE_VERIFICATION.sql` and paste them in.
3. Click **Run**. This file is read-only — it only counts and checks; it changes nothing.
4. The editor will show result rows for each check. Select all the output (or screenshot it) and send it to me.

## Step 4 — I verify and report

From your verification output I will check, one by one:

- All required tables exist: `profiles`, `goals`, `daily_top_tasks`, `score_events`, `coin_transactions`, and the rest of the 31 baseline tables
- The public leaderboard view exists
- RLS is enabled and policies exist on every table
- Helper functions and the new-user profile trigger are present
- Storage rules for profile photos

Then I report exactly:

- **READY FOR 8 PHASE 1 PROMPTS** — staging matches the app schema, Phase 1 can proceed against staging, or
- **BLOCKED** — with a named list of what's missing and the smallest fix for each.

## Safety notes

- Only the staging project is touched, and only by your own hand.
- The rollback file (`AXEN_STAGING_BASELINE_ROLLBACK.sql`) exists but is **not** part of this walkthrough — use it only if I tell you to after a failure.
- No service-role key, database password, or access token is needed for any of this. The SQL Editor already runs with the right privileges when you're signed in as the project owner.
- Production (`nfmgiczlthezfwgsazfc`), the published app, and Phase 1 remain untouched throughout.

## What this does NOT do

- Does not modify, seed, or delete production data or production configuration.
- Does not run Phase 1 or any Phase 1 test.
- Does not change code, UI, auth, or deployment.
