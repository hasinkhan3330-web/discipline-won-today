# Completion coin rewards — implementation and test evidence

## Scope and reused system
Reused `profiles.coins`, `coin_transactions`, `focus_sessions`, `daily_contracts`, `contract_sessions`, `proof_submissions`, `score_events`, `daily_top_tasks` and `task_completions`. Reused/extended `award_contract` (including its `finalize_contract_and_award` wrapper), `complete_top_task`, `complete_zen_session`, existing economy/server-write guards and RLS. No new tables or second coin system.

Regular verified Contract pays +10, once/day; recovery coins and XP remain unchanged. Zen pays +10 only for the full selected 300/600/900/1200 seconds and at most once/day. Existing Top 3 Missions slots pay +10 each once/slot/day. As clarified in the approved plan, these completion rewards are separate from the unchanged 50-coin cap on other activities. Limits and amounts are sourced in `src/lib/coin-reward-config.ts`; the SQL config generator and integration assertion prevent silent divergence.

Reward day uses database `now()` and protected `profiles.reward_timezone`, default Asia/Kolkata, initialized from valid stored timezone settings. No client date is accepted by award RPCs. Serialized per-user transactions, source/daily unique indexes, and guarded private award helpers atomically update ledger and balance. Historical balance/ledger offsets were not reconciled or deleted.

Zen reward eligibility uses server start and active duration with 15-second client heartbeats and a 45-second stale threshold. Pause time is excluded; restart, departure and hidden-page cancel the reward session. Full completion after a daily claim still works and returns zero. These checks prove elapsed session evidence, not that a person was meditating; automation can simulate legitimate heartbeat traffic. Network failure or throttling can make reward evidence ineligible without disabling the meditation UI.

## Actual test output
`bun test tests/*.test.ts tests/*.test.tsx`:
```
58 pass
0 fail
103 expect() calls
Ran 58 tests across 4 files. [33.62s]
```
Covered all four Zen durations via privileged isolated backdated fixtures; incomplete/cancelled/paused sessions; 299-second rejection; daily claim/replay; two parallel submissions; prior-day ledger rollover fixture; three mission slots; planning/unplanned tasks; client date change; Kolkata default and blocked timezone tampering; stored Kolkata/Kiritimati/Honolulu dates; cross-account access; protected ledger/balance/evidence; Contract +10 then 0 with unchanged 20 XP; config parity; 50-cap exemption; ledger sum; rendered badge states/balance; existing privacy and milestone regressions.

After final display refinements, affected presentation/regression tests ran again:
```
35 pass
0 fail
46 expect() calls
Ran 35 tests across 3 files. [107.00ms]
```

Signed-in Chromium preview: Home content checks at CSS widths 360/390/430 found zero overflowing descendants; Zen reward pill rendered; actual server-backed start/pause controls worked; zero uncaught browser errors. Screenshots/logs are under `/tmp/browser/coin-rewards/`. Automatic build log: `build OK` at 05:10:16. This was desktop Chromium, not physical Android or screenshot pixel parity.

Final database cleanup query: `temporary_accounts = 0`, `temporary_functions = 0`. Test helpers were service-role-only and restricted to unique `coin-test-*` accounts; migration 0018 removed all three helper functions. Real server tests require provisioning these isolated helpers in a disposable test backend (0012–0017) before rerunning; do not reinstall them on production just to run the suite.

## Remaining manual/device checks
- On Android, finish an uninterrupted real 5-minute session; observe +10, then complete again for zero and truthful daily-claimed text.
- Repeat full 10/15/20-minute sessions on distinct fresh days/accounts; check background, pause/resume, offline and app-close behavior.
- Keep the app open across actual stored-timezone midnight; confirm availability refresh and one award per new calendar day. Automated rollover used prior-day ledger fixtures, not a physical midnight wait.
- Observe earned transition, one shimmer, 600ms count-up and eight particles; repeat with reduced motion. Automated badge checks covered rendered variants; motion timing and physical-device accessibility remain manual.

## Changed files
- Badge: `src/components/CoinBadge.tsx`, `src/components/coin-badge.module.css`.
- Reward config/client: `src/lib/coin-reward-config.ts`, `src/lib/coin-rewards.ts`, `src/hooks/useDailyCoinRewards.ts`, `src/hooks/useMeditation.ts`, `scripts/generate-coin-reward-config.ts`.
- Reward amounts/copy: `src/lib/economy.ts`, `src/lib/coach-knowledge.ts`.
- Coin presentation/wiring only: `src/components/TopThreeModal.tsx`, `src/components/verified/ContractCard.tsx`, `src/components/verified/ContractSheet.tsx`, `src/components/verified/contract-visuals.module.css`, `src/components/zen/eclipse.module.css`, `src/tabs/ZenTab.tsx`, `src/tabs/HomeTab.tsx`, `src/tabs/RankTab.tsx`, `src/tabs/StatsTab.tsx`, `src/tabs/ProfileTab.tsx`, `src/tabs/ProfileDetailScreens.tsx`, `src/components/DeepFocus.tsx`, `src/components/VerifiedRankAdditions.tsx`, `src/components/ShieldCard.tsx`, `src/routes/_authenticated/dashboard.tsx`.
- Tests: `tests/coin-rewards-server.test.ts`, `tests/coin-badge.test.tsx`.
- Migrations: `0010_completion_coin_rewards.sql`, `0011_guard_zen_reward_evidence.sql`, `0012_temporary_coin_test_fixture.sql`, `0013_correct_coin_contract_test_fixture.sql`, `0014_isolated_coin_fixture_cleanup.sql`, `0015_repair_temporary_fixture_cleanup.sql`, `0016_strict_full_zen_completion.sql`, `0017_temporary_coin_edge_case_fixture.sql`, `0018_remove_temporary_coin_test_functions.sql` under `drizzle/migrations/`; autogenerated migration metadata and `src/integrations/supabase/types.ts`.
- Notes: `.lovable/plan.md`, `AGENTS.md`, `roadmap.md`, this report.

Only requested coin displays and necessary reward/configuration code changed across these screens; no unrelated screen redesign, global CSS/theme-token changes, navigation/auth/purchase logic changes or data reconciliation. Database migrations were applied; no app publication was performed.
