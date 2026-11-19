# Daily Coin Decay (server-authoritative)

## Findings that change the brief
- `apply_daily_penalty()` today uses a different rule: UTC day, deducts 3 if ANY active task was missed, clamps with `GREATEST(0, coins-3)`, logs reason `penalty`, and only runs when the app opens (dashboard calls it).
- No CHECK constraint on `profiles.coins`; the only thing blocking negatives is that `GREATEST(0, …)` clamp.
- No cron jobs exist today.
- Running the old rule and the new rule side by side would penalize twice, so the old rule must be retired, not kept beside the new one.

## Rule (from your message)
For each finished local day after signup day: earned = positive coins credited that day. earned >= 15 → nothing. earned < 15 → wallet −3, no floor. Earned coins stay. 50/day cap untouched.

## What changes
1. New private table `daily_coin_decay` (user_id, local_day, earned, penalized, created_at), primary key (user_id, local_day) = idempotency key. No client grants; RLS on.
2. New private function `axen_apply_coin_decay(uid)`: locks profile `FOR UPDATE`, sets `app.economy_write`, walks every finished local day from max(signup day + 1, last processed day + 1, start date) to yesterday in the user's timezone, inserts the key row `ON CONFLICT DO NOTHING`, and only if inserted and earned < 15: `coins = coins - 3` and ledger row amount −3, reason `daily_penalty`, label "Daily penalty -3", `reward_local_date` = that day. Catch-up capped at 60 days per run.
3. `apply_daily_penalty()` keeps its name, signature, return shape, SECURITY DEFINER, search_path and grants; its body becomes a call to the new function for `auth.uid()`. This is the only place the clamp is removed (the one allowed change). Old rule no longer applies.
4. Cron job `axen-daily-coin-decay`, hourly at minute 5 (24 runs/day), loops users in batches and calls the new function, so each timezone is processed within ~1 hour of its midnight even if the app is never opened. Pure SQL, no edge function.
5. Frontend: coin balance shows red with a minus sign when negative (CoinBadge balance only). Rank math already uses `Math.max(0, coins)` so ranks don't go below the first tier.

## Earned-coins definition
Sum of positive `coin_transactions` that local day, excluding referral, gift, streak_milestone, shield refunds and pact hold/refund/payout (not earned from tasks).

## Tests (rolled back, on existing rows, no test accounts, no real writes kept)
Earned 20 / 15 / 14 / 0; 3 missed days in a row; 0 → -3 → -6 → -9; -9 + 20 earned = 11; job run twice = one penalty; 50/day cap returns 0 room after 50. Plus a Vitest for the pure threshold rule. Output pasted in the report with migration SQL and cron config.

## Technical details
- Local day via existing `axen_user_local_day` / profile timezone, UTC fallback.
- Signup day = `profiles.created_at` in user timezone.
- Start date default: the day this ships (no retroactive penalties for past months).
- Dashboard toast copy ("You missed a task yesterday") left unchanged per no-copy rule; it will now fire on the new rule.
- Rollback: unschedule cron, restore previous `apply_daily_penalty` body (saved in report).
