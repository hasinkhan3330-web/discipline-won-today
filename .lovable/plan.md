# Phase 2: lifecycle and coins (reuse first)

## 1. What already exists (LIVE + CODE), to be reused
| Step | Existing path | Status |
|---|---|---|
| Create/edit pact | Browser writes `daily_contracts` directly (`ContractCard.tsx:103,110`), guarded by triggers `trg_guard_contract_fields` (server-only fields, timezone validated, no past times) and `trg_guard_comeback_fields` | client write, guarded |
| Start/end session | `start_contract_session`, `end_contract_session` (`contract-session.ts:43,84`) | server |
| Submit proof | server function `contract-proof.functions.ts:111` inserts as the user, then `verify_contract_proof` (not callable by users) | server fn + client grant |
| Partner review | `partner_proof_action` | server |
| Coins/XP | `finalize_contract_and_award` → `award_contract` (advisory lock + row lock, `score_events` unique key) → `axen_award_completion_coins` (existing ledger and 50/day room) | server |
| Comeback | `start_recovery`, `axen_finalize_comeback` (row lock, cron) | server |
| Missed | set server-side by `check_my_comebacks` / finalizer | server |
| Pause/Resume, reschedule | Recovery view in `AccountabilitySection.tsx` (direct `daily_contracts` update) | client write, guarded |

No new create/start/end/submit/review/award functions will be added; they already exist.

## 2. Coin rules: needs your decision (nothing built until you answer)
Today a pact pays through `axen_award_completion_coins` (shared completion reward and 50/day cap), and a recovered pact pays 2. Your brief asks for a user-chosen 1–10 reward, a separate 10/day accountability cap and 60% for recovered pacts. Building that changes coin amounts and touches the protected coin logic. Options:
- **A (recommended):** keep today's coin amounts and add nothing.
- **B:** add the new rules inside `award_contract` only (no second award function). This changes how many coins users get.

## 3. Build now (independent of the decision)
1. **Check-in day guard:** a BEFORE INSERT/UPDATE trigger on `acct_checkins`. `day` must be within ±1 of `acct_user_today(user_id)` (the stored, validated reward timezone). Otherwise the save is refused with a generic error. Garden formula unchanged. The Daily check-in screen already sends today, so no UI change.
2. **Pact writes via server:** new `save_pact(_id uuid, _payload jsonb)` SECURITY DEFINER, `search_path=public`, user from `auth.uid()`, row `FOR UPDATE` on edit. It does the same insert/update, so all existing triggers still run. Same for `set_pact_pause(_id, _paused)` and reschedule if they are direct writes. Switch `ContractCard.tsx` and the Recovery view calls to these; screens unchanged.
3. **Proof insert:** move the insert in `contract-proof.functions.ts` into the existing server path (`submit_contract_proof` RPC with ownership + session checks, then the existing `verify_contract_proof`).
4. **End of phase only, after a browser check of Contract sheet (new/edit/draft), Recovery (pause/resume/reschedule) and proof submit with writes intercepted:** revoke INSERT/UPDATE on `daily_contracts` and INSERT on `proof_submissions` from `authenticated`. Rollback SQL is included in the report.

## 4. Already confirmed (LIVE)
`acct_is_party` and `acct_connection_active_for`: anon EXECUTE = false, authenticated = true (needed by the access rules).

## Evidence then STOP
Policies, grants, function ACLs and definitions for everything touched; max 8-line report.

## NOT VERIFIED
Real saves on your account are not done (no real writes). The other callers of direct `daily_contracts` writes will be searched again before the revoke.
