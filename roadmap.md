# AXEN VERIFIED DISCIPLINE SYSTEM — Task Roadmap

## Real 4AM web alarm
- [ ] Server scheduling, private challenge history, verified solve and existing-ledger daily rewards
- [ ] Wake-only saved UI, Overnight Mode, readiness/test and authenticated ringing route
- [ ] Push subscription/outbox, bounded processors and private monitoring
- [ ] Bun/server/browser/load checks and honest verification report; no publication

## Zen-only eclipse screenshot rebuild
- [x] Replace Zen presentation with supplied eclipse SVG and selection layout; preserve existing session/audio/settings handlers and isolate styles/fonts to Zen. Existing hook default remains 10 minutes to avoid changing session logic; selecting 5 uses real state.
- [x] Signed-in real selection, sound/preset readback, sliders/cues, start/pause/resume/restart and Breath/Sound/Body access passed; 360/380/390/414px no horizontal overflow, reduced-motion and simulated visibility passed, zero page errors, 31 existing Bun tests passed. Physical devices, full session reward completion, exact screenshot pixel equivalence and WCAG AA audit not verified; supplied tiny muted text/colors preserved.

## Contract-only black-card visual redesign
- [x] Redesign all Home Contract states and New/Edit sheet with isolated CSS module and Contract-only controls; existing actions, fields, validation and server calls preserved. Global CSS, shared controls and other screens untouched.
- [x] Signed-in live empty/create/suggest/review/edit flow passed; display-only fixtures cover scheduled, active, proof_pending, verified, rewarded, missed and draft at 360/380/430px without overflow. All edited fields retained through review/edit, close and reduced-motion checks passed; zero browser errors and 31 existing unit tests passed. Build OK; no database writes, publication or physical-device testing.

## Rank Pro gate regression
- [x] Confirmed expired-access bypass in signed-in preview; restored the shared entitlement gate around Leaderboard and Rank sections only.
- [x] Signed-in browser regression with controlled server responses passed Basic/expired blocking, upgrade and Basic exit, subscribed/trial progression access; 31 existing unit tests passed, build OK. No account/payment data changed; no publication.

## Bright seal v2 and verified member additions
- [x] Replace shared seal artwork with requested bright serrated SVG and top-right milestone contact; existing one-time server shine consumption retained.
- [x] Add authenticated member-scoped permanent tier/coin projection, compact chips and tappable seals; preserve list order and geometry.
- [x] 31 unit tests passed; live authenticated membership matches all four filters, pinned search_path/anonymous denial confirmed. Before/after 390px rows, avatar positions, fonts and order identical; 360/390/430px chips and Stats checks passed. Controlled-response badge/tooltip and RPC-failure checks passed; no database test data created. Build OK; no publishing or physical-device testing. Live members are below badge thresholds; earned Rank badges were verified with response fixtures only.

## Stats and Rank metallic badge adjustment
- [x] Place metallic seal tiers beneath Stats circles and replace Rank profile ticks with five existing server coin tiers; no database/reward changes.
- [x] 20 tests passed; signed-in Stats 360/390/430px placement/no-overflow and reduced-motion passed; four Rank filters and preserved sections passed, no page errors, build OK. Five Rank artworks checked separately; live listed accounts have no qualifying badges, so an earned live Rank badge was not observed. No publication or physical-device test.

## Surgical Rank section restoration
- [x] Re-mount existing Daily Motivation, Rank Progress, Current Rank Rewards and Earn XP sections below Verified Rank List with live user data; keep inline members removed.
- [x] Signed-in 360/390/430px screenshots show restored sections and no inline members/overflow; all four filters, refresh, list opening, horizontal rows, motivation, ranks, reward details and Home navigation passed; zero page errors, build OK. No publication; physical devices untested.

## Milestone-only metallic seals
- [x] Server coin-threshold unlocks, protected persistent records and idempotent backfill; ten live boundaries passed, rewards unchanged.
- [x] Milestone-only SVG seals, one-time shine and reduced-motion support; shared badges untouched.
- [x] 14 unit tests, live forgery/privacy/concurrency/permanence checks, signed-in Stats screenshots at 360/390/430px, zero page errors; ten temporary accounts deleted with zero checked leftovers. Physical devices not tested; not published.

## Current surgical privacy fix
- [x] Remove email/username fallbacks from public name displays and leaderboard/partner output; preserve ranking, badges and auth.
- [x] Run name/data privacy tests and signed-in Rank filter/dialog checks (4 helper tests, 4 authenticated SQL fixtures, 13 safe network responses, all four filters/dialog/refresh, zero page errors; build OK).

Approved plan: `.lovable/plan/axen-verified-discipline-system-implementation-plan-2026-09-22.md`
Hard gate after each phase: IMPLEMENT → TEST → SECURITY CHECK → MOBILE CHECK.

## Phases
- [ ] Staging connection — collect STAGING_SUPABASE_URL + STAGING_SUPABASE_ANON_KEY securely; runtime staging client + preview-only `?staging=1` toggle; verify production path unchanged (saved URL confirmed = staging ref pfjsskutkoibvputlqpj; built-in backend cannot be swapped)
- [ ] Staging baseline V2 — BLOCKED on user: run AXEN_STAGING_INVENTORY.sql in staging SQL Editor and paste output; then generate AXEN_STAGING_BASELINE_FORWARD_V2.sql
- [x] Phase 1 — Database foundation (applied to LIVE 2026-09-24 by owner request; reuses score_events; untested with real accounts): daily_contracts, contract_sessions, proof_submissions, recovery_events, accountability_connections/invites/events, contract_events (GRANT + RLS + triggers + indexes)
- [ ] Phase 2 — Server functions: src/lib/verified/contracts.functions.ts (create/start/pause/end/checkpoint, submitProof/verifyProof, finalizeContractAndAward, startRecovery, reschedule, accountability invite/accept/revoke/nudge)
- [ ] Phase 3 — Home "Today's Contract" card (src/components/verified/ContractCard.tsx, mounted in HomeTab)
- [x] Phase 4 — Proof step (PASSED by owner decision, Option B: all proof tests pass; intermittent "state update on unmounted component" warning on Home load logged as known pre-existing issue, not investigated)
- [x] Phase 5 — Verified XP and coins: finalize_contract_and_award wrapper + CLAIM REWARD on card (PASSED)
- [x] Phase 6 — Same-day recovery (PASSED: 22 server checks + card UI flow, rescue CTA, reason, Recovered 8 XP · 2 coins)
- [x] Phase 7 — Accountability + Soft Shield (PASSED)
- [x] Phase 8 — Validation complete (report delivered; accepted exceptions: feature flags, physical device tests, Android URL). Awaiting APPROVE PRODUCTION PROMOTION.

## Constraints
- [x] Finish Comeback server timer, reopen/duplicate/scheduler checks, Recovered phone screenshot and complete temporary-data cleanup (37 tables checked; physical-device testing not performed).
- Additive-only; never touch existing UI/theme/routes/auth/economy.
- XP ledger = score_events (kinds: contract_verified / contract_recovery); coins via existing pattern.
- Soft Shield only (no fake app blocking); Android only; no iOS.
- [x] Phase 2 — Today's Contract card + create/review/confirm sheet, reschedule, cancel (live; 33 DB checks + preview flow pass)
- [x] Phase 3 — Reminders + focus session (PASSED)
- [x] Phase 4 — Proof step (PASSED by owner decision, Option B: all proof tests pass; intermittent "state update on unmounted component" warning on Home load logged as known pre-existing issue, not investigated)
- [x] Phase 7 — Accountability + Soft Shield (PASSED)

## Economy + XP + Milestones + Goals + Habits + Coach (pending plan approval)
- [x] Coin economy (20/15-tier/10/2/3, focus music 0, 50/day cap)
- [x] XP info dot
- [x] Streak milestones 7/21/100/290/365 + badges on profile/rank
- [x] Goals 18,000 linked-habit coins + info text
- [x] Wake Up alarm math/science challenge (no face/selfie check); Cold Shower/Workout simple tap; custom habit 1–5, no scan proof
- [x] Coach full app knowledge
- [x] Gap closure: real-streak badge guard, selfie liveness, recalc_goal owner check, full test report
- [x] Rank-only photo badges — updated to latest coin-only thresholds (pink/green/blue/black/GOAT); signed-in Rank badge lookup, vertical profile directory and dot; no reward or ranking changes. Device validation remains outside browser checks.
- [x] Face/selfie verification removed; previous alarm challenge restored
- [x] Accountability rebuild — five fixed smart nudges, verified daily check-in, two-sided commitments, aggregate partner stats, and Emergency Nudge through the existing live partner flow

## Completion-only CoinBadge rewards
- [x] Scoped badge and coin display replacements
- [x] Server local-day limits, Zen lifecycle, Contract and Top 3 awards
- [x] Automated and authenticated server proof; cleanup and report (`docs/coin-rewards-verification.md`; physical-device/midnight/motion checks remain manual)
