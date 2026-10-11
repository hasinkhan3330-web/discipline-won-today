# AXEN CoinBadge and completion-only daily rewards

## Scope and resolved choices
- Add the requested reusable coin pill and change only the specified reward paths and coin displays. Preserve all other layouts, styles, navigation, authentication, purchases, XP, rankings and completion requirements.
- **Top 3 means the existing Top 3 Missions plan**, not the first three ordinary Home habits.
- **These rewards are exempt from the existing 50-coin activity cap**, per your answer. Other activities retain their existing cap and reward values; exclude these new rewards from consuming their cap allowance.
- Zen: +10 for the first eligible full session per local day; later sessions complete normally for 0.
- Regular verified Contract: +10 for the first eligible contract per local day; later verified contracts finish normally for 0. Preserve the separate existing Comeback/recovery rewards and behavior.
- Top 3: +10 per planned mission, once per slot per local day. All ordinary habits retain their values.
- No code or database changes have been applied for this feature. Approval authorizes this scoped implementation, not publishing.

## Audit findings confirmed this turn
- The existing economy uses `profiles.coins` and `coin_transactions`; `score_events` is the separate XP ledger.
- Live `award_contract` currently pays regular contracts 20 coins and recovery 2, preserves verified-proof/completed-session checks, locks the contract and writes XP/coins transactionally. `finalize_contract_and_award` delegates to it.
- Live `complete_zen_session` currently accepts minutes, pays up to 5 coins and checks time since the previous recorded Zen session—not a server-recorded start for the current session.
- `focus_sessions` already has session token, start and end timestamps, minutes, tier and awarded coins; reuse it for Zen rather than add another session table.
- Live `complete_top_task` uses the existing three daily slots, UTC dates and 7/7/6 rewards. `daily_top_tasks` already has a unique `(user_id, day, slot)` key.
- The existing local-day helper derives timezone from stored contracts/reminders and defaults to UTC. `profiles` has no dedicated timezone column. Do not change this shared helper or silently alter other features' day definitions.
- Coin-ledger RLS allows owner reads only. Profile owner updates are permitted, while the economy trigger preserves protected coin fields. Do not describe profile balance protection as RLS alone.
- Existing tests use `bun:test`; reuse this runner rather than add a second runner.
- **Baseline warning:** the live aggregate check found balance-versus-ledger differences for 13 of 13 profiles. Do not rewrite historical balances or invent ledger entries. Verify exact equality on clean test accounts and verify real-account balance deltas equal new ledger deltas, preserving their original offsets. The final report will disclose this pre-existing mismatch.

## CoinBadge and display-only replacements
- Create `CoinBadge.tsx` with its own scoped CSS module. Reuse the existing Lucide `Coins` linked-coins glyph; do not draw another icon.
- Apply your exact 28px pill dimensions, 14px icon/number, dark/light palettes, available/earned/disabled states, small earned check, accessible labels and tabular numerals.
- Animate only a newly server-confirmed award: 250ms fill, one shimmer, 600ms balance count-up and at most eight particles. No replay on refresh or ordinary rerender; reduced motion disables effects.
- Replace coin amounts/reward labels—not surrounding layouts—across Contract, Zen, Home habits, Top 3, priority/custom habits, Deep Focus, Rank/verified rows, Stats/profile balances and other located coin displays. Keep unrelated values, badge thresholds and ranking logic unchanged.
- Put the Contract reward badge in the Home card and New/Edit sheet headers. Add only the specified reward helper line. New/edit views show the user's daily availability, not a promise of another payout.
- Add the thin Zen reward row above START SESSION. Use server-read daily availability and the exact claimed copy: “Daily reward claimed · resets at midnight”. Show earned +10 only for an actual award; later completions show “Session complete. Today's coin reward was already earned.”
- Read actual awarded amounts for completed missions/contracts. Historical rewards remain historical; do not relabel old +20/+7/+6 payments as +10.

## Technical implementation
### Single economy, stored timezone and atomic daily limits
- Add a scoped reward config file containing `ZEN_MAX_REWARDED_PER_DAY = 1`, `CONTRACT_MAX_REWARDED_PER_DAY = 1` and the three +10 values. Generate the relevant migration constants from that source so browser and server definitions cannot drift independently.
- Add an additive `profiles.reward_timezone` field for these reward sources only, defaulting to `Asia/Kolkata`. Initialize from a valid existing stored contract/reminder timezone when available. Resolve dates using database time and this stored IANA timezone, never device time or a client-supplied award date.
- Persist the timezone snapshot/local day on new reward records. Changing a device clock never changes eligibility. No new timezone settings screen or auth/profile redesign.
- Add nullable source/local-day/idempotency fields and narrowly scoped unique indexes to the **existing coin ledger**. Leave historical rows intact; no duplicate coin tables or second balance.
- Serialize same-user reward checks and writes with database locking. Enforce daily source keys for Zen/regular Contract and per-slot/day keys for Top 3, plus per-session/per-contract idempotency.
- Update existing award RPCs in place; atomically insert the ledger row, update the balance and store the actual award. Do not accept user IDs, amounts or dates as authority from the client.
- Keep XP and recovery behavior unchanged. Audit any callers that assumed “rewarded” means positive coins and make them display the actual returned amount.
- Count existing same-day qualifying payouts as already claimed at rollout, so deployment does not grant an extra reward. Preserve old rewards without retroactive recalculation.

### Zen eligibility lifecycle
- Add server-authoritative start/cancel/progress support using the existing `focus_sessions` rows, with only additive fields needed for duration, lifecycle and active elapsed time.
- Register a start with the selected allowed duration (300/600/900/1200 seconds) and database timestamp. Complete only by session ID through the existing completion award path.
- Require ownership, an unrewarded eligible session, full completion callback, and server elapsed time of at least `duration_seconds - 2`.
- Mark stop/restart/selection change/leaving Zen as reward-ineligible without altering the breathing/timer experience. Pausing/resuming keeps its existing behavior but cannot count paused time as completed duration.
- Use expiring server progress/liveness evidence so closing the app cannot earn coins simply by waiting and submitting an old start. Never rely solely on an unload request. A stale or interrupted session may finish visually but receives no reward.
- Retire the minutes-only payout bypass; retain compatibility only where it cannot grant coins without a validated session. Inspect the existing meditation-habit completion callback so this flow cannot accidentally award a second Zen reward; preserve unrelated habit rewards.
- Report the browser lifecycle limitations honestly: server elapsed time is not proof of attention, and real-device closure/background tests are separate from automated checks.

### Top 3 and security
- Use the new server local-day response for loading/planning/completing the existing Top 3 slots; do not use a device-derived day for reward eligibility.
- Preserve the existing Mark done requirement and all-three aggregation. Merely saving/planning a task pays 0.
- Preserve owner-read access and server-only ledger writes. Inspect grants and relevant triggers before applying any narrowly required permission changes.
- Block direct client coin changes without removing legitimate profile editing. Verify ledger inserts and balance updates are denied or leave protected values unchanged, identifying the actual RLS/grant/trigger enforcement separately.
- Apply all additive schema/function/index changes through a reviewed migration; no production publishing and no unrelated permission or role work.

## Test proof after approval
1. Run existing tests and new Bun tests for concrete reward values, all four Zen durations with fake timers, early stop/restart/leave, pause exclusion and before-duration rejection.
2. Test CoinBadge's available +10, earned +10, balance “39 coins”, disabled state and accessible reward values. Use rendered assertions for these requested variants, not styling snapshots.
3. Run authenticated tests against the real award RPCs with isolated temporary accounts: first Zen +10; second/third same-day 0; early stop leaves reward available; replay pays nothing; parallel calls pay +10 once.
4. Test regular Contract verification/incomplete denial, per-contract replay, first daily +10 and second daily 0; verify XP and recovery values remain unchanged.
5. Test each Top 3 slot +10 once/day, incomplete/planned 0, retries and parallel calls, all-three behavior and ordinary habit rewards unchanged.
6. Exercise Asia/Kolkata midnight and another stored timezone with controlled **test-only** database clock fixtures; also change browser/device clock and confirm it cannot unlock a second payout. Production functions continue to use database time.
7. Verify clean-account balance equals the ledger sum, each award's balance delta equals its ledger delta, no partial awards, cap exemptions and the direct-client denied boundaries. Preserve all existing real-account balances and original ledger offsets.
8. Exercise signed-in UI start→completion→read-back and daily claimed states. Check 360/380/390/414px, reduced motion, bounded particles, no horizontal overflow, no new console errors and unchanged nav/paywall behavior. Fake-time UI tests do not substitute for server-time tests.
9. Delete temporary test accounts/records, confirm cleanup, and report actual runner output and pass/fail counts. Mark any unavailable real-device or server tests UNVERIFIED rather than claiming success.

## Final delivery
List every changed file and applied migration, explain reuse of the existing ledger/balance/RPCs, provide actual test output, disclose historical balance offsets and any verification gaps, and confirm changes outside these reward paths are coin-display substitutions only. No publishing without separate approval.