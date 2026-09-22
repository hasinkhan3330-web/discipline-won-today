# AXEN VERIFIED DISCIPLINE SYSTEM — Implementation Plan

Additive-only integration into the existing AXEN app. Zero changes to existing UI, theme, routes, auth, economy, or data. Every requirement below is classified: **A** safe additive, **B** adapt to existing architecture, **C** platform-limited, **D** server-enforced, **E** needs device/testing.

## Key adaptations (B) — preserving existing architecture

- **No Edge Functions in this project.** The spec's "Edge Function" logic will be TanStack Start server functions (`createServerFn` with `requireSupabaseAuth`) — the same secure server-side pattern every existing AXEN reward already uses. No new runtime added.
- **XP ledger: reuse `score_events`.** It already has a unique `idempotency_key`, `points`, `kind`, `occurred_at`. New ledger entries use `kind` values `contract_verified` / `contract_recovery` (additive metadata). No second ledger table, no rewrite of historical XP. Coins keep flowing through the existing `coin_transactions` + `complete_*` SECURITY DEFINER pattern.
- **Sessions: extend via new `contract_sessions`** (audit confirmed `focus_sessions` is Deep-Focus-specific; a new table is safer than widening it).
- **Reminders: reuse `src/lib/local-notifications.ts`** (Capacitor `@capacitor/local-notifications`) — no competing notification system. Contextual permission request, in-app fallback, timezone-safe scheduling, stable IDs, reschedule-on-change.
- **Proof AI: reuse the existing server-side Roboflow vision pipeline** (`roboflow.functions.ts` pattern) for photo/QR proofs; deterministic rules first, AI only where a key already exists server-side. Strict structured JSON validated server-side before storage.
- **Soft Shield only for release 1 (C).** Android cannot block other apps without AccessibilityService/usage access; iOS project does not exist. No fake blocking claims. Full-screen focus UI, exit confirmation, distraction logging, screen-awake option. Strict Shield is a later, separately approved phase.
- **Focus timer: reuse the Deep Focus UI/timer engine via a backward-compatible wrapper** with new contract state persisted to `contract_sessions` checkpoints (recoverable after backgrounding/kill; remaining time computed from timestamps).

## Phase 1 — Database foundation (D)

One migration, additive tables, exact structure: CREATE → GRANT → ENABLE RLS → owner-only policies.

- `daily_contracts` — user_id, goal_id (nullable FK to existing goals), title, category, scheduled_at timestamptz, timezone, planned/rescue duration seconds, trigger_text, proof_method, status (draft/scheduled/active/proof_pending/verified/completed/rewarded/rescheduled/missed/recovery), difficulty, accountability_enabled, private_note, started/completed/expires/rewarded_at, version. CHECKs on durations and status transitions (trigger), partial unique index: one active primary contract per user/local day.
- `contract_sessions` — contract_id, user_id, started/expected_end/ended_at, elapsed_seconds, pause_seconds, exit_reason, session_status, client_instance_id. Partial unique index on active sessions (prevents duplicate start under race).
- `proof_submissions` — contract_id, session_id, proof_type, private_storage_path, text_evidence, status (verified/needs_review/retry_requested/rejected/unavailable), confidence, reason_code, verifier_version, retry_count. Client cannot write status (trigger + policies; verification only via server RPC).
- `recovery_events` — original/recovery contract ids, user_id, reason. One recovery reward per contract (unique constraint).
- `accountability_connections`, `accountability_invites` (token_hash, expires_at, one-time acceptance), `accountability_events` — self-invite blocked, one active partner.
- `contract_events` — append-only event log.
- All reward-bearing tables get the existing `protect_verified_reward_fields` pattern extended (server-only `app.economy_write`).
- Indexes on user_id, contract_id, scheduled_at, status, created_at. Explicit GRANTs; no anon access.

## Phase 2 — Server functions (D)

New isolated modules `src/lib/verified/contracts.functions.ts` (+ `.server.ts` helpers), all authenticated, all with idempotency keys:

- `createContract`, `startContract`, `pauseContract`, `endContract` (reason), `checkpointSession`
- `submitProof` → stores submission; `verifyProof` (server-side Roboflow/deterministic, structured JSON, outage → "Verification pending" + retry with backoff, never loses proof, no duplicate award on retry)
- `finalizeContractAndAward` — the single SECURITY-safe transaction: authenticate → ownership → proof/session check → not-already-rewarded (unique constraint) → server-computed XP + coins via existing ledger insert pattern → mark rewarded → return balance
- `startRecovery` (20% duration, reduced XP, expires end of local day, max one), `rescheduleContract`
- `createAccountabilityInvite` / `acceptInvite` / `revoke` / `sendNudge` — rate-limited, secure random tokens hashed at rest, partner reads via SECURITY DEFINER RPC only (never raw row access)

AI contract suggestions: deterministic templates first; optional server-side AI via existing gateway key (never in frontend). User explicitly confirms every suggestion.

## Phase 3 — Home "Today's Contract" card (A)

New isolated component `src/components/verified/ContractCard.tsx`, mounted in HomeTab at the existing daily-missions/focus entry point using the existing card component, colors, glow, spacing, animations. One primary contract; all six states (empty / scheduled / active / awaiting-proof / completed / missed) exactly as specified; existing Home content untouched below it.

## Phase 4 — Contract creation sheet + focus session (A)

- New `ContractSheet.tsx` bottom sheet matching existing AXEN modal language: goal link (optional, suggests small measurable action, never auto-commits), title, category, date/time, IANA timezone, durations, rescue duration, cue, proof method, optional partner, reminder preference, difficulty, private note.
- New `ContractFocusSession.tsx` wrapping the existing Deep Focus timer engine: prefilled task/duration/sound, live timer, timestamp-based remaining time, DB checkpoints, resume after kill. Controls: I'm Stuck / Pause (if allowed) / End Session (confirm + reason) / Emergency Exit. No trapping.

## Phase 5 — Adaptive reminders (A/E)

Extend existing `local-notifications.ts` with contract scheduling: prep (default 5 min), start, missed-start follow-up; READY / RESCHEDULE / RESCUE actions where supported. Contextual permission, quiet hours, DST/timezone-change handling, cancel+recreate on change, stable IDs, no spam, in-app fallback when denied, graceful degradation on web, event logging. Never promise exact timing beyond what Android guarantees.

## Phase 6 — Proof engine + optional photo storage (A/D)

Proof methods per spec defaults (timer+recall for study/work, Zen session link for meditation, timer/checklist for workout, etc.). New private `contract-proofs` storage bucket: signed upload URLs, owner-scoped prefix, size/type limits, client-side compression + EXIF stripping, rate limits, retention-based deletion of rejected/expired proofs. Outcomes never punish on a single ambiguous AI result.

## Phase 7 — Accountability (A/D)

New additive section reusing existing pact/friends patterns: expiring invite link/code, accept/decline, remove, block/report, max one partner, share-only-enabled fields, supportive nudges with rate limits, no public feed, no partner access to proofs/notes/health/location by default (explicit per-proof "Share this proof" only).

## Phase 8 — Validation + rollout (E)

- SQL RLS/security tests: anon denied, cross-user denial, partner-field isolation, revoked access, no self-award, no proof-status editing, invite reuse blocked.
- Server-function idempotency/replay tests; duplicate-award SQL checks.
- Playwright at mobile width: card states, creation sheet, session flow, proof flow, recovery, zero console errors.
- `bun run build` + typecheck.
- Real Android device build for notification timing (cannot be verified in preview).
- Rollback: frontend revert fully disables the feature; all tables additive and untouched; optional feature flag on the Home card mount.

## Files that must NOT change

`src/integrations/supabase/*`, `src/start.ts` middleware array, `src/router.tsx`, `_authenticated/route.tsx`, all existing `complete_*` RPCs, `profiles` economy columns, existing RLS/migrations, RevenueCat webhook, all existing page designs/routes. `dashboard.tsx` touched only for mount points if unavoidable; `HomeTab.tsx` gains one card mount; `styles.css` gains one scoped block only.

## Confirmed limits (E)

- Android only; no iOS project — strict Shield iOS work is out of scope.
- No guaranteed exact alarms or background execution; documented graceful behavior.
- Real-device notification testing and Play purchase testing remain user-side steps.
