# Phase 4 — Proportionate Proof: Implementation Plan (exact lines)

Decisions applied: Phase 4 = proof step. Photos are checked and discarded, never stored. **Zero database changes.** No XP/coins (award_contract is not called).

## Verified facts this plan relies on
- `verify_contract_proof` can be run only by the server role (signed-in users cannot run it), so clients cannot self-verify. The new server function calls it with the server role, only after it has checked the caller.
- `guard_proof_submission` forces client inserts to `submitted`, owned contract in `active`/`proof_pending`, and a matching session.
- Zen completions are rows in `focus_sessions` with `tier = 'zen'` (written by `complete_zen_session`). Read-only use.
- The photo check key (`ROBOFLOW_API_KEY`, `ROBOFLOW_MODEL`) is already on the server.

## New files

### 1. `src/lib/verified/contract-proof.functions.ts`
`submitContractProof` — POST, `.middleware([requireSupabaseAuth])`.
Input (validated): `{ contractId: uuid, recall?: string (<=600), checklist?: boolean[] (<=10), imageBase64?: string (<=11MB) }`.
Steps:
1. Read the contract as the caller (RLS). Must be `proof_pending`, else return `{ ok:false, code:"not_pending" }`.
2. Read latest `contract_sessions` for it: must be `completed`. Only if so, continue.
3. Idempotency: if a proof for this contract is already `verified`, return it. If one is `submitted`/`needs_review`, return that state (no second row). Double-tap is also locked in the UI.
4. Check by `proof_method`:
   - `timer` — completed session is the proof → verified (confidence 1).
   - `timer_recall` — recall text ≥ 40 chars and ≥ 8 words, not repeated characters → verified; else `retry_requested` (reason `recall_too_short`).
   - `checklist` — at least 1 item and all ticked → verified; else retry.
   - `photo` — sends the image to the same detector used by the habit photo check (same env keys, same model, same 0.4 confidence floor, 8s timeout). A small private copy of the call lives in this file so `roboflow.functions.ts` is not edited. Image is never saved. Match ≥ 0.4 → verified; lower → `retry_requested` (after 3 retries → `needs_review`); detector missing/down → `unavailable`.
   - `zen_session` — a `focus_sessions` zen row created after the contract session started → verified; else retry with "Finish a Zen session first".
5. Insert `proof_submissions` as the caller (guard forces `submitted`; `text_evidence` = recall text only for `timer_recall`, trimmed, else null; `private_storage_path` always null).
6. Load `supabaseAdmin` inside the handler and call `verify_contract_proof(proof_id, status, confidence, reason, 'p4-v1')`.
7. Return `{ ok, status, reason }`. Friendly messages only; no raw errors.

### 2. `src/components/verified/ContractProofSheet.tsx`
Full-screen overlay in the same style as `ContractSheet` (AX colours, cardStyle, titleStyle). Shows the method-specific input: nothing extra (timer), text box (recall), tick list built from the contract title (checklist, 3 items: "Started on time", "Stayed on the task", "Finished the planned work"), photo picker with preview (photo), "Open Zen" hint (zen). One SUBMIT PROOF button with busy lock; result messages for verified / try again / under review / check unavailable / offline / signed out. Close always available.

## Modified: `src/components/verified/ContractCard.tsx` only

Line 15 — change copy:
```
- proof_pending: "Session done — proof step comes next", verified: "Verified",
+ proof_pending: "Session done — submit proof", verified: "Verified",
```
After line 7 — add import:
```
+ import { ContractProofSheet } from "./ContractProofSheet";
```
Near the existing `sheet` state — add:
```
+ const [proofOpen, setProofOpen] = useState(false);
```
Lines 159–161 (`else` read-only branch) — add a proof_pending branch before it:
```
+ } else if (row.status === "proof_pending") {
+   body = <>{title}<div style={{ fontSize: 12, color: AX.flame, marginTop: 4 }}>{READ_ONLY.proof_pending}</div>{details}
+     <button style={{ ...buttonStyle(), width: "100%", marginTop: 14, minHeight: 48 }} onClick={() => setProofOpen(true)} disabled={busy}>SUBMIT PROOF</button></>;
  } else {
```
After the `ContractSheet` block (line ~177) — add:
```
+ {proofOpen && row && (
+   <ContractProofSheet contract={row} onClose={() => setProofOpen(false)}
+     onDone={() => { setProofOpen(false); void load(); }} />
+ )}
```
Nothing else in the card changes. `verified` keeps showing "Verified" read-only.

## Will NOT touch
Database (no migration, no bucket), Phase 1 tables/functions/policies, ContractSheet, reminders, focus session, timer, HomeTab, DeepFocus.tsx, Zen files, PhotoProof/TaskVerify/HabitVision, roboflow.functions.ts, vision.ts, XP/coins/award_contract, recovery, accountability, navigation, theme.

## Tests (stop on first real failure, no auto-fix)
Server/DB (throwaway accounts, rolled back, plus server function calls):
1. timer → verified, contract `verified`. 2. recall too short → retry; good recall → verified. 3. checklist partial → retry; all → verified. 4. photo match → verified; no match → retry; 4th → needs_review; photo never stored (path null, no bucket). 5. zen with/without a Zen session. 6. double submit → one proof row. 7. contract not proof_pending → refused. 8. user A cannot submit for B's contract. 9. client calling `verify_contract_proof` directly → denied. 10. client insert with status `verified` → forced to `submitted`. 11. no coins/XP change.
Preview (signed in): 12. proof_pending card shows SUBMIT PROOF and sheet opens. 13. submitting a real proof moves card to Verified (uses a real contract — needs a new day since today's is Missed; otherwise tested on a throwaway account).
Regression: 14. Phase 2 create/cancel. 15. Phase 3 start/session. 16. Deep Focus opens. 17. Zen opens. 18. Home sections + 6 bottom tabs. 19. no console errors. 20. typecheck + build clean.

## Rollback
Delete the two new files and revert the 5 small card edits. No database rollback needed.
