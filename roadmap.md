# AXEN VERIFIED DISCIPLINE SYSTEM — Task Roadmap

Approved plan: `.lovable/plan/axen-verified-discipline-system-implementation-plan-2026-09-22.md`
Hard gate after each phase: IMPLEMENT → TEST → SECURITY CHECK → MOBILE CHECK.

## Phases
- [ ] Staging connection — collect STAGING_SUPABASE_URL + STAGING_SUPABASE_ANON_KEY securely; runtime staging client + preview-only `?staging=1` toggle; verify production path unchanged
- [ ] Phase 1 — Database foundation: daily_contracts, contract_sessions, proof_submissions, recovery_events, accountability_connections/invites/events, contract_events (GRANT + RLS + triggers + indexes)
- [ ] Phase 2 — Server functions: src/lib/verified/contracts.functions.ts (create/start/pause/end/checkpoint, submitProof/verifyProof, finalizeContractAndAward, startRecovery, reschedule, accountability invite/accept/revoke/nudge)
- [ ] Phase 3 — Home "Today's Contract" card (src/components/verified/ContractCard.tsx, mounted in HomeTab)
- [ ] Phase 4 — ContractSheet.tsx creation modal + ContractFocusSession.tsx timer wrapper
- [ ] Phase 5 — Adaptive reminders (extend src/lib/local-notifications.ts)
- [ ] Phase 6 — Proof engine + private contract-proofs bucket (signed URLs, EXIF strip, retention)
- [ ] Phase 7 — Accountability UI (invite/accept/remove/block/nudge, share-only-enabled)
- [ ] Phase 8 — Validation: SQL RLS tests, idempotency tests, Playwright mobile, build + typecheck

## Constraints
- Additive-only; never touch existing UI/theme/routes/auth/economy.
- XP ledger = score_events (kinds: contract_verified / contract_recovery); coins via existing pattern.
- Soft Shield only (no fake app blocking); Android only; no iOS.
