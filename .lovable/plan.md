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

---

# AXEN audit — Part 2 of 3 (server functions and app writes)

I only read things here. LIVE = checked in the real database today. CODE = read in the files.

## SECURITY DEFINER functions (LIVE)
- There are 105. Every one sets a fixed search_path (`public` or empty).
- Signed-out visitors can run only one of them, `wake_timezone_reschedule`. It is a trigger function, so nobody can call it directly. No exposure.
- 38 of them touch coins. These ones lock the rows they change and use unique keys, so a reward is paid once: `award_contract`, `axen_award_completion_coins`, `complete_top_task`, `wake_submit_answer`, `wake_finalize_solve`, `axen_finalize_comeback`, `buy_streak_shield`, `redeem_referral_code`, `send_accountability_nudge`, `complete_zen_session`.
- Each of these pays only once per item and day through a unique-key insert (`ON CONFLICT DO NOTHING`), with no row lock: `complete_task`, `complete_alarm`, `claim_streak_milestones`, `complete_focus_music_session`.

## Risks
| Rank | Confidence | Finding | Evidence |
|---|---|---|---|
| Medium | High | **Daily −3 penalty can be taken twice.** It reads `last_penalty_date` with no row lock, so two app opens at the same moment can both pass the check and both deduct. It also uses UTC "yesterday", not the user's own day. | `apply_daily_penalty()` lines 18–34 (LIVE) |
| Medium | Medium | **Daily coin cap can be slightly exceeded.** Two task completions at the same moment both read the remaining daily room before either writes. Each task still pays only once. | `complete_task` → `axen_daily_coin_room(_uid)` with no lock on `profiles` (LIVE) |
| Low | High | The app changes a task's points from the browser just before completing it, then resets it to 10. The server clamps points to 1–5 (`validate_task_builder_fields`, `complete_task`), so there is no coin gain. If the reset fails, the stored value just stays wrong. | `src/routes/_authenticated/dashboard.tsx` lines 501–508 (CODE) |
| Low | High | The browser writes check-ins (`upsert`) and can pick any `day`. Pair streak and rewards read `daily_contracts`, not check-ins, so this only changes what the user sees. | `src/components/verified/acct/AcctScreens.tsx:239` (CODE), `acct_pair_streak` (LIVE) |
| Low | High | The browser writes tasks directly (insert/update/deactivate). The rules allow own rows only, and triggers `enforce_task_limit_trg` and `validate_task_builder_fields_trg` limit the values. | `dashboard.tsx:633`, `GoalHabitPicker.tsx:62,75`, `ProfileDetailScreens.tsx:115`, `src/lib/coach-tools.ts:130,363,373` (CODE) |
| Low | High | Alarms: the browser only reads them. Reward fields are server-owned (`wake_alarm_server_fields` trigger). `complete_alarm` refuses the Wake Protocol alarm and is capped by the daily room. | `WakeProtocol.tsx:108` (CODE), triggers on `alarms` (LIVE) |

## NOT VERIFIED
- The full bodies of the other ~60 functions. I only checked them by pattern: lock, unique key, auth check.
- Whether the two Medium cases actually happened in real data.
- Server functions in `src/utils/*.functions.ts`, apart from the ones above.

SELECT-only SQL to look for double penalties:
```sql
select user_id, created_at::date d, count(*) from coin_transactions where reason='penalty' group by 1,2 having count(*)>1;
```

---

# AXEN audit — Part 3 of 3 (screens, what stays unchanged, phased plan)

## Public endpoints (CODE)
- `src/routes/api/public/payments/revenuecat-webhook.ts`: checks the Bearer secret `REVENUECAT_WEBHOOK_SECRET` and re-reads the subscriber from RevenueCat. Low: the check is a plain `!==` comparison, not a constant-time one.
- `src/routes/api/public/wake/process.ts`: compares the Bearer `WAKE_JOB_SECRET` via SHA-256 hashes. OK.
- Whether these secrets are actually set: NOT VERIFIED (values are never read).

## Screens and features that must stay unchanged (CODE)
- Routes: `/`, `/dashboard`, `/alarm`, `/my-plan`, `/checkout/success`, `/join/$code`, `/pro`, `/privacy`, `/terms`, `/refund`, `/reset-password`, `/auth/forgot`, `/auth/verified`, `/mcp`.
- Tabs: Home (`HomeTab.tsx`, Command Center, Today Missions, My Plan shortcut), Stats (`StatsTab.tsx`, milestone seals), Rank (`RankTab.tsx`, Leaderboard, RankEmblem, Verified Rank List), Zen (`ZenTab.tsx`, eclipse design, Frequency Hub), You/Profile (`ProfileTab.tsx`, `ProfileDetailScreens.tsx`, Account page, Referral, Subscription).
- Features: Contracts (`ContractCard/Sheet/ProofSheet/FocusSession.tsx`), Deep Focus, Accountability batches 1–4 (`AccountabilitySection.tsx`, `acct/*`, `NudgeListener.tsx`), Goals plan dot, 4AM Wake Protocol and missions, Coach text/voice orb, Dark/Simple theme (Simple is the default), trial and entitlement gates, RevenueCat payments.
- The rules in AGENTS.md and project memory stay in force.

## All risks (Parts 1–3)
| # | Rank | Conf. | Finding | Source |
|---|---|---|---|---|
| 1 | Medium | High | `apply_daily_penalty` can deduct twice under concurrent calls and uses a UTC day | LIVE |
| 2 | Medium | Medium | `complete_task` daily coin cap can be exceeded under concurrent calls | LIVE |
| 3 | Medium | High | `coach_messages_delete_own` overrides `coach_messages_no_delete` | LIVE |
| 4 | Medium | High | `partner_messages_party_read` has no active-partnership check (table is empty and unused) | LIVE |
| 5 | Low | High | RevenueCat secret compared with a plain `!==`, not constant-time | CODE |
| 6 | Low | High | Points override set from the browser in `dashboard.tsx:501–508` (clamped by the server) | CODE |
| 7 | Low | High | Check-in `day` is picked by the browser (display only) | CODE |
| 8 | Low | High | Leftover anon read grants on 8 tables (blocked by policies) | LIVE |
No Critical or High issues were found in what I inspected.

## Phased plan (each phase separate, after your approval)
**Phase A: penalty lock (#1).** One migration with `CREATE OR REPLACE apply_daily_penalty`: add `SELECT … FOR UPDATE` on the user's `profiles` row and keep everything else. The UTC→local-day change stays a separate decision because it changes behaviour. Test: two parallel calls in a rolled-back transaction → one deduction. Rollback: re-apply the current function body (saved before the change).
**Phase B: daily cap lock (#2).** Same pattern in `complete_task`: lock `profiles` before `axen_daily_coin_room`. Test: parallel completions stay under the cap. Rollback: previous body.
**Phase C: policies (#3, #4).** Make `coach_messages_no_delete` RESTRICTIVE, or drop `coach_messages_delete_own`. Add `acct_connection_active_for(connection_id, auth.uid())` to `partner_messages_party_read`. Check first whether the app uses delete on coach messages (NOT VERIFIED). Test: a third account sees nothing and delete is blocked, all in a rolled-back transaction. Rollback: recreate the old policies.
**Phase D: webhook (#5).** `revenuecat-webhook.ts`: compare SHA-256 hashes the same way as `wake/process.ts`. Test: wrong secret → 401. Rollback: revert the file.
**Phase E: cleanup (#6, #8), optional.** Remove the points override in `dashboard.tsx` and revoke the unused anon grants. Rollback: revert, re-grant.
Every phase: no UI change, no new dependency, no test accounts, typecheck and build, report.

## NOT VERIFIED overall
Full bodies of about 60 functions, `src/utils/*.functions.ts` server functions beyond those cited, real-data impact of #1 and #2, secret presence, and real-device behaviour.
