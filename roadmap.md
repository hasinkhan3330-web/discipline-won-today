# AXEN VERIFIED DISCIPLINE SYSTEM — Task Roadmap

## Bright seal v2 and verified member additions
- [ ] Replace shared seal artwork with requested bright serrated SVG and restore top-right milestone contact only.
- [ ] Add authenticated member-scoped permanent tier/coin projection, compact chips and tappable seals; preserve list order and geometry.
- [ ] Run boundary/security tests and signed-in before/after phone checks; no publishing.

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
