# Phase 5 — Verified XP and Coins: Step 0 Audit (read-only, zero code)

Nothing has been written or applied. Everything below comes from live database reads and a code search done this turn.

## Important finding first

The reward function you asked for **already exists** from Phase 1: `award_contract`. It already does steps 1–10 in one transaction, pays 20 XP + 5 coins (8 + 2 for recovery), and is protected by a database unique key. The app never calls it yet (nothing in the frontend uses it). Creating `finalize_contract_and_award` as a separate full copy would be a second reward path, which Rule 1 forbids.

Also: the proof screen named in your last line was built and passed in Phase 4. Submitting proof already moves the contract to Verified. Phase 5 is only the reward step after that.

## A) Existing economy structure

### 1. score_events (XP ledger)
- Columns: id uuid, user_id uuid, points integer (1–500, check `points > 0 AND points <= 500`), kind text, idempotency_key text, occurred_at timestamptz, created_at timestamptz.
- No `metadata` or `source` column (so `{contract_id, phase:"p5"}` cannot be stored without changing the table — not allowed).
- Indexes: primary key; **unique `score_events_idempotency_key_key`**; `(user_id, occurred_at desc)`.
- Policies: select own only. No insert/update/delete for users. No anon grants.
- Triggers: none.
- XP total: there is no XP column. XP = sum of `points` for the user.

### 2. coin_transactions
- Columns: id, user_id, amount integer, reason text, ref_id uuid, created_at.
- Policies: select own only. No user writes.
- No unique key on (reason, ref_id).
- Balance: stored in `profiles.coins`; transactions are the history.

### 3. profiles
- Coins: `coins`, `shields`. Streak: `streak`, `longest_streak`.
- No XP or rank column. Protected by trigger `guard_profile_economy` (users can't change coins/streak/etc. unless a server function turns on its internal write flag).

### 4. award_contract(_contract_id uuid) — existing
Returns (xp, coins, already_awarded). Security definer, search path pinned to empty. Executable by authenticated and service role only (not PUBLIC, not anon).
Steps:
1. No signed-in user -> refused.
2. Locks the contract row where id matches AND owner = caller; else "contract not found".
3. Already `rewarded` -> returns the stored amounts with already_awarded = true, awards nothing.
4. Status not `verified` -> refused.
5. Needs a verified proof and a completed session by the same user.
6. Amounts fixed on the server: 20 XP + 5 coins, or 8 + 2 if recovery.
7. Inserts score_events with key `contract:<contract_id>` (conflict -> error, full rollback).
8. Inserts coin_transactions (reason `contract_reward`, ref = contract), adds coins to profile.
9. Sets contract to `rewarded`, xp_awarded, coins_awarded, rewarded_at = now.
10. Logs a `rewarded` event. All in one transaction.

Tested in Phase 1 (claiming bug fixed then). Takes only a contract id — no amount can be sent.

### 5. Existing duplicate prevention
- Unique idempotency key on score_events.
- Row lock (`FOR UPDATE`) on the contract, so concurrent calls queue and the second sees `rewarded`.
- Contract guard trigger makes `rewarded` final and reward fields server-only.

### 6. Leaderboard
`leaderboard_scores` = positive coin_transactions + score_events points, weekly or all-time. `leaderboard_top` and `my_leaderboard_position` read that. Ranks come from this ordering. A contract reward will therefore add 25 leaderboard points (20 XP + 5 coins), same as every other reward already works.

### 7. Files that touch XP/coins
ProfileTab, dashboard route, ReferralCard, RankScan, DeepFocus, TopThreeModal, Leaderboard, VoiceCoach, FriendsPanel, coach / coach-context / focus-music server functions. ContractCard only shows the word "Completed" for rewarded. None call award_contract.

## B) Proposed changes (pending your choice below)

Recommended (Option 1 — reuse, no new reward logic):
- **New database function** `finalize_contract_and_award(_contract_id uuid)`: a thin wrapper that calls the existing `award_contract` and then returns status (`awarded` / `already_rewarded`), amounts, new coin balance and new XP total. No inserts of its own. Pinned search path, revoked from PUBLIC and anon, granted to authenticated only. Full SQL shown before applying.
- **Modify** `src/components/verified/ContractCard.tsx` only: in the `verified` state, add a CLAIM REWARD button that sends just the contract id, with a busy lock; show "+20 XP · +5 coins" only after the server confirms. Exact lines shown in the next step.
- No change to any table, index, policy, rank or leaderboard code.

Option 2: skip the wrapper and call `award_contract` directly from the card (zero database change; no balance returned — card re-reads it).

Idempotency key: the existing key is `contract:<contract_id>`. Contract ids are unique per user, so this already means one reward per contract ever. Changing it to `user_id + contract_id + reward` would require editing award_contract; I recommend keeping it.

## C) Confirmed untouched
score_events and coin_transactions structure; rank calculation; leaderboard functions and Leaderboard.tsx; Phase 1–4 functions, tables and files (except the one card addition); DeepFocus, Zen, navigation; historical XP and coins.

## Tests after build
The 20 tests you listed, run in a fully rolled-back transaction with two throwaway accounts, plus a snapshot of every user's coins and XP sum before and after. One preview check using a temporary contract (dated 2027, removed afterwards). Stop on any failure.

## Decisions needed
1. Option 1 (thin wrapper) or Option 2 (use award_contract directly)?
2. Keep existing key `contract:<id>`, or change it (means editing award_contract)?
3. No `metadata` column exists on score_events — OK to skip it?
