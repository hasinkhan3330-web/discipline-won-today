# AXEN VERIFIED DISCIPLINE SYSTEM — Task Roadmap

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
- Additive-only; never touch existing UI/theme/routes/auth/economy.
- XP ledger = score_events (kinds: contract_verified / contract_recovery); coins via existing pattern.
- Soft Shield only (no fake app blocking); Android only; no iOS.
- [x] Phase 2 — Today's Contract card + create/review/confirm sheet, reschedule, cancel (live; 33 DB checks + preview flow pass)
- [x] Phase 3 — Reminders + focus session (PASSED)
- [x] Phase 4 — Proof step (PASSED by owner decision, Option B: all proof tests pass; intermittent "state update on unmounted component" warning on Home load logged as known pre-existing issue, not investigated)
- [x] Phase 7 — Accountability + Soft Shield (PASSED)

## Economy + XP + Milestones + Goals + Habits + Coach (pending plan approval)
- [ ] Coin economy (20/15-tier/10/2/3, focus music 0, 50/day cap)
- [ ] XP info dot
- [ ] Streak milestones 7/21/100/290/365 + badges on profile/rank
- [ ] Goals 18,000 linked-habit coins + info text
- [ ] Wake Up 4AM live-selfie verify (4:00–4:30, auto-delete); Cold Shower/Workout simple tap; custom habit 1–5, no scan proof
- [ ] Coach full app knowledge
