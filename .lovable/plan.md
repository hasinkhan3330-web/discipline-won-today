# Access rules check (read-only result + optional hardening)

## What the check found
- All 51 public tables have row-level access rules turned ON.
- No rule anywhere lets signed-out visitors read data. Every read rule applies to signed-in users only.
- 4 tables have no rules at all, so they are fully locked for app users: `alarm_events`, `wake_question_history`, `wake_delivery_log`, `wake_push_outbox`, `wake_push_subscriptions` (only server functions reach them).
- 33 tables (including `score_events`, `profiles`, `coin_transactions`, `payment_events`) still keep the database's default read permission for signed-out visitors. The access rules block those reads anyway, so nothing leaks today. But that means only one layer of protection.

## Optional change (only if you approve)
Remove the default signed-out read permission from those 33 tables, the way it was already done for the wake-alarm and Accountability tables. Signed-in behaviour, screens, coins, rewards and payments stay the same.

## Technical details
- One migration: `REVOKE ALL ON public.<table> FROM anon;` for the 33 tables that still grant it to anon. The `authenticated` grants and every RLS policy stay as they are.
- `billing_plans` stays readable if the pricing screen needs it while signed out. I'll check that before revoking.
- After that, verify with `has_table_privilege('anon', ...)` reads and a signed-out request that gets denied.
