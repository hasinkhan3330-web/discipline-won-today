# Phase 4 — Proportionate Proof: Step 0 Audit (read-only, zero code)

Assumption: Phase 4 = "Proportionate Proof" (the next step in the approved order: Contract → Reminders/Focus → **Proof** → Verified XP → Recovery → Accountability). If your Phase 4 spec is different, paste it and I'll re-audit against it.

## A) Existing files and objects (verified this turn)

App code
- `src/components/verified/ContractCard.tsx` (180 lines) — Phase 2/3. `proof_pending` currently shows "Session done — proof step comes next" (line 15). No proof action yet.
- `src/components/verified/ContractFocusSession.tsx` (196) — Phase 3 session overlay; ends with `completed` → contract becomes `proof_pending`.
- `src/lib/verified/contracts.ts` (124) — proof methods: `timer`, `timer_recall`, `checklist`, `photo`, `zen_session`.
- `src/lib/verified/contract-session.ts` (97), `contract-reminders.ts` (88) — Phase 3.
- `src/components/PhotoProof.tsx` — existing photo check for habits (picks a photo, checks it on the server via the image model).
- `src/utils/roboflow.functions.ts` — existing server function `detectHabitEvidence`.
- `src/lib/vision.ts` — `VisionKind` (focus/shower/workout/custom), accepted labels, copy, `isAcceptedClass`.
- `src/components/TaskVerify.tsx` (305), `src/components/HabitVision.tsx` (`logVision`) — existing habit verification flows.

Database (Phase 1, live)
- Table `proof_submissions` with policies `ps_insert_own` (INSERT) and `ps_select_own` (SELECT). No user UPDATE/DELETE.
- Trigger `guard_proof_submission` — forces user_id = caller, contract must be owned and `active`/`proof_pending`, session must match, storage path must start with the user's id, client inserts always forced to `submitted`; status changes are server-only.
- RPC `verify_contract_proof(_proof_id, _status, _confidence, _reason, _verifier)` — server-only status set; `verified` moves contract `proof_pending → verified` and logs an event; idempotent on `verified`/`rejected`.
- RPC `award_contract` exists — **not used in Phase 4** (that is the Verified XP phase).
- Storage: only the public `avatars` bucket exists. **No private proof bucket yet.**

## B) Proposed (for approval — nothing written)

New files
- `src/lib/verified/contract-proof.functions.ts` — server function `submitContractProof` (auth required): inserts the proof as the user, runs the proportionate check per method, then calls `verify_contract_proof` with the server role. Checks:
  - `timer` — server confirms a `completed` session reaching planned time → verified.
  - `timer_recall` — session completed + 1–3 sentence recall (length/quality rules, no AI) → verified.
  - `checklist` — session completed + all ticked items → verified.
  - `photo` — reuses `detectHabitEvidence` logic (no new vision code); confident match → verified, low confidence → retry_requested (max 3), else needs_review.
  - `zen_session` — a Zen session completed today after the contract start → verified (read-only look at existing data).
- `src/components/verified/ContractProofSheet.tsx` — proof step overlay, same look as ContractSheet; reuses `PhotoProof`-style picker.

Modified (small, additive)
- `ContractCard.tsx` — `proof_pending` branch: replace the static line with a "SUBMIT PROOF" button opening the sheet; show retry/needs-review text. Exact lines shown in the implementation plan.
- `HomeTab.tsx` — none expected (sheet mounted inside the card).

Database (only if you approve; full SQL shown first)
- Private bucket `contract-proofs` (not public), storage policies scoped to `<user_id>/` folder, `IF NOT EXISTS` / `DROP POLICY IF EXISTS` style. Needed only for the photo method; photos are checked then stored privately. If you prefer, photo can be checked without storing (no DB change at all).

## C) Will NOT touch
Phase 1 tables/functions/policies, Phase 2 contract creation/sheet, Phase 3 reminders/focus session/timer, `DeepFocus.tsx`, Zen files, existing habit PhotoProof/TaskVerify behaviour, `roboflow.functions.ts` (reused, not edited), XP/coins/`award_contract`, recovery, accountability, navigation, other Home sections, theme.

## Decisions needed
1. Confirm Phase 4 = Proportionate Proof (or paste your spec).
2. Photo proof: store privately (adds a private bucket) or check-only, never stored (zero DB change)?

## Tests (after build, stop on any failure)
Each method verifies correctly; rejected/low-confidence paths; retry cap; double submit → one proof; user A can't submit/see B's proof; client can't self-verify; no XP/coins awarded; Phases 1–3 flows, Deep Focus, Zen, Home, tabs unchanged; no console/type/build errors.
