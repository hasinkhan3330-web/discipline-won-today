# Phase 6 — Same-Day Recovery: Step 0 Audit (read-only, zero code)

Nothing has been changed. Everything below was read from the live database and the app code.

## Key finding

The recovery function you asked for **already exists** from Phase 1: `start_recovery(_original_id, _reason)`. Under the no-duplicates rule I will not create a second `create_recovery_contract`. I'll reuse `start_recovery` and only fix the gaps listed in section B.

## A) Existing structures

### 1. recovery_events
- Columns: id uuid, user_id uuid, original_contract_id uuid, recovery_contract_id uuid, reason text (at most 200 characters), created_at timestamptz
- Unique rules: **UNIQUE(original_contract_id)** already exists (`recovery_events_original_contract_id_key`), plus UNIQUE(recovery_contract_id)
- Index: `re_user_idx` (user_id, created_at desc)
- Access rules: only `re_select_own` (users read their own rows). The app can't add, change or delete rows.
- A second safety rule on daily_contracts: `dc_one_recovery_per_original` (unique recovery_of_id). So Rule 1 is already enforced twice. It also holds when a recovery is cancelled, because rows are never deleted.

### 2. daily_contracts: the "missed" status
- Only the server sets it, inside `end_contract_session`: a session ended before the rescue time turns the contract `missed`. For a recovery contract, the bar is its full planned time.
- The guard also allows the server to move scheduled → missed and proof_pending → missed, but **nothing currently does this automatically**. A contract whose time passes without being started stays "scheduled". There is no timestamp sweep.
- The column is `rescue_seconds`, not `rescue_duration_seconds`. It allows 60–3600 and must be less than `planned_seconds`, which allows 300–14400. Duration is stored in `planned_seconds`.

### 3. award_contract (unchanged in this phase)
- It already handles recovery: `is_recovery` gives **8 XP + 2 coins**, and a normal contract gives 20 XP + 5 coins.
- It tells them apart by the server-set `is_recovery` column. The guard makes that column immutable and client-proof.
- Its duplicate-protection key is `contract:<id>` on score_events (unique). The original and the recovery are separate rows, so:
  - The original can't be rewarded: `missed` is final for it, and the guard allows no path from missed to verified.
  - The recovery can be rewarded only once.

### 4. Local day and time zone
- The IANA time zone is stored per contract in `daily_contracts.timezone`. The server checks it against `pg_timezone_names`.
- `local_day` is always recomputed on the server as `(scheduled_at AT TIME ZONE timezone)::date`.
- `start_recovery` checks `(now() AT TIME ZONE tz)::date = local_day` and sets `expires_at = (local_day + 1)::timestamp AT TIME ZONE tz`. That is the true end of the local day, and it is safe across daylight-saving changes.
- On the app side, `localToday(tz)` in ContractCard and `deviceTimezone()` in `src/lib/verified/contracts.ts` are used for display and filtering only.

### 5. ContractCard.tsx: missed branch
- Line 17: `READ_ONLY` map, `rewarded: "Completed", missed: "Missed"`
- Lines 41–43: the loader filters **`.eq("is_recovery", false)`**, so a recovery contract would never appear on the card today.
- Lines 187–189: the final else branch renders missed as red "Missed" text with **no button**.

### 6. Files that touch contract status, recovery or local day
- Server: `start_contract_session`, `end_contract_session`, `verify_contract_proof`, `award_contract`, `finalize_contract_and_award`, `start_recovery`, `guard_contract_fields`
- App: `src/components/verified/ContractCard.tsx`, `ContractSheet.tsx`, `ContractFocusSession.tsx`, `ContractProofSheet.tsx`, `src/lib/verified/contracts.ts`, `contract-session.ts`, `contract-reminders.ts`, `contract-proof.functions.ts`
- No other app code has recovery logic.

## B) Gaps between `start_recovery` and your rules (need your decision)

1. **Rounding.** Today it uses 20% of the seconds, at least 300. For 45 minutes that gives 540 s (9 minutes), which is already a whole minute. Your example says "9 → 10". Pick one:
   - (a) Round to the nearest minute: 45 min → 9 min.
   - (b) Round up to the next 5 minutes: 45 min → 10 min.
   Either way the result is capped at the original length. **Fix:** `CREATE OR REPLACE start_recovery` with the chosen formula.
2. **"already_exists".** A second attempt today fails with a raw unique-violation error. **Fix:** check first and raise a clear `already_exists` error. The unique rule still settles a race between two taps.
3. **Title.** Today the recovery's title is "Recovery: <title>". Your rule says "same title". Pick one: keep the prefix, or use the exact same title.
4. **Reason.** It is stored as free text. **Fix:** accept only time_conflict, task_too_large, low_energy, forgot, distraction or other (or none).
5. **Expiry after the day ends (Rule 4).** Still to verify before the SQL step: whether `start_contract_session`, `end_contract_session` and proof submission reject a recovery after `expires_at`. If they don't, I'll add an `expires_at` check. This is shown as SQL first.
6. **Execute permission.** Before the SQL step I'll confirm that signed-in users can run `start_recovery` and signed-out visitors can't.

All of these are edits to the one existing function (`CREATE OR REPLACE`), plus at most small expiry checks in the session functions. **No new tables, columns or indexes.**

## Proposed file changes (exact lines shown at the card step)

- **New:** none, except possibly `src/lib/verified/recovery.ts` (a thin `supabase.rpc("start_recovery")` wrapper plus reason labels).
- **Change: `src/components/verified/ContractCard.tsx` only**
  - Loader (lines 41–43): if today's primary contract is missed and a recovery row exists, show the recovery contract instead.
  - Missed branch (lines 187–189): the copy becomes "You still have today. Start your rescue version." It gets an optional reason picker and a **START X-MINUTE RECOVERY** button. The server makes the recovery contract, then the existing START / session / proof / CLAIM flow runs as-is.
  - Rewarded branch: a recovery shows a **"Recovered"** badge with "8 XP · 2 coins". A normal contract keeps "Completed".
  - No shame words anywhere.

## C) Confirmed untouched

- `award_contract`, `finalize_contract_and_award`, `score_events`, `coin_transactions`: unchanged
- Phase 1–5 tables, rules and screens (sheet, focus session, proof sheet): unchanged
- DeepFocus.tsx, Zen files, navigation, all other Home sections: unchanged
- Accountability: untouched. Phase 7: not started. Nothing merged or published.

## Next steps after your approval

1. You answer B1 (rounding) and B3 (title).
2. I show the full SQL for `start_recovery` plus any expiry checks, and wait.
3. I show the exact card line changes, and wait.
4. I implement, run all 25 tests, stop on any failure, and report PHASE 6 PASSED or BLOCKED.
