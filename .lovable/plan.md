# AXEN audit — Part 1 of 3 (database security)

I only read things. Nothing was changed. "LIVE" means I checked it in the real database today. "CODE" means I read it in the files.

## What I checked (LIVE)
- 62 tables in `public`. **Every table has row security switched on.**
- Storage: `avatars` (private, rules let you read/insert/update/delete only your own files) and 4 `database_export_*` buckets (private, no user rules, so users can't reach them).
- Routes (CODE): `/`, `/dashboard`, `/alarm`, `/my-plan`, `/checkout/success`, `/join/$code`, `/pro`, `/privacy`, `/terms`, `/refund`, `/reset-password`, `/auth/forgot`, `/auth/verified`, `/mcp`, `src/routes/api/public/*`. There are no `supabase/functions` (server code lives in TanStack server functions).

## Risks found
| Rank | Finding | Evidence |
|---|---|---|
| Medium | Users can delete their own coach messages, although a "never delete" rule exists. Two allow-type rules are added together, so the delete rule wins over the block rule. | `coach_messages_delete_own` and `coach_messages_no_delete` (both PERMISSIVE) |
| Medium | `partner_messages` can be read by the sender and recipient even after a partnership is removed or blocked. It is empty today and the app doesn't use it. | `partner_messages_party_read` |
| Low | Some tables give signed-out visitors read access at the grant level, but every rule is for signed-in users only, so nothing is exposed. Leftover grants. | anon SELECT on `acct_cheers`, `acct_checkins`, `acct_settings`, `acct_milestones_seen`, `coach_memory`, `coach_plans`, `coach_plan_materialized`, `coach_profile` |
| Low | Server-only wake tables have write grants but no rules, so they are locked to users (this is intended). | `wake_push_outbox`, `wake_delivery_log`, `wake_push_subscriptions` |

## Checked and OK (LIVE)
- Coins: users can only read `coin_transactions`, `score_events`, `entitlements`, `trust_events`. Profile coin and streak fields are protected by the trigger `guard_profile_economy_trg`.
- Payments: `subscriptions` and `payment_events` can be written only by the server (`service_role`).
- Pacts: `daily_contracts` insert/update allow only drafts/editable rows, plus the triggers `trg_guard_contract_fields` and `trg_guard_comeback_fields`. Rewards go through `finalize_contract_and_award`.
- Top tasks `protect_daily_top_task_rewards`, goals `guard_goal_coins`, unlocks `guard_streak_unlocks`, proofs `trg_guard_proof_submission`, Zen `guard_zen_reward_evidence`.
- Premium gates on `focus_sessions`, `friendships`, `streak_shield_uses` are RESTRICTIVE, so they correctly sit on top of the own-row rules.
- `partner_events`: readable only while the partnership is active; the recipient can update only `seen_at`.

## NOT VERIFIED yet (Parts 2–3)
- The bodies of SECURITY DEFINER functions (race conditions, row locks, unique keys) — Part 2.
- The client code that writes `acct_checkins`, `tasks`, `alarms` directly — Part 2.
- Screens/features that must stay unchanged, and a phased fix plan with rollback — Part 3.

## SELECT-only SQL you can run yourself
```sql
select relname, relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where nspname='public' and relkind='r' order by 2;
select tablename, policyname, permissive, roles, cmd, qual, with_check from pg_policies where schemaname='public' order by 1;
select table_name, grantee, privilege_type from information_schema.role_table_grants where table_schema='public' and grantee in ('anon','authenticated') order by 1;
select id, public from storage.buckets;
select c.relname, t.tgname from pg_trigger t join pg_class c on c.oid=t.tgrelid where not t.tgisinternal and c.relnamespace='public'::regnamespace order by 1;
```

## Proposed fixes (only after you approve)
1. Make `coach_messages_no_delete` RESTRICTIVE, or drop `coach_messages_delete_own`. Rollback: restore the old rule.
2. Add an active-partnership check to `partner_messages_party_read`. Rollback: restore the old rule.
3. Optional: revoke the unused anon grants. Rollback: grant them again.
