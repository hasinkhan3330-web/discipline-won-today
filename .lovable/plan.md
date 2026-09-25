# Phase 3 — Implementation plan (approved decisions folded in)

Decisions: (1a) legitimate exit = session `abandoned`, contract stays `active` — no migration. (2a) new `ContractFocusSession` overlay; `DeepFocus.tsx` untouched. No quiet hours. **No database change of any kind.**

## New files

**1. `src/lib/verified/contract-reminders.ts`**
- Reuses `scheduleLocalReminder`, `cancelLocalReminder`, `stableNotificationId` from `src/lib/local-notifications.ts`. No new plugin.
- IDs: `stableNotificationId("contract:<id>:prep")` and `...:start` (offset default 5000); deterministic per contract, so no duplicates ever.
- `scheduleContractReminders(contract)`: cancels both IDs first, then schedules
  - prep at `scheduled_at − 5 min`, body "Prep: <title> starts in 5 minutes."
  - start at `scheduled_at`, body "Start now: <title>"
  - skipped silently if the instant is already past. Uses the stored `scheduled_at` timestamp (UTC instant), so DST in Asia/Calcutta is handled by the clock, not us.
  - `reminder_pref` respected: `"none"` → schedule nothing; `"start"` → start only; `"prep"` → both.
  - permission is requested by the OS only at this point (after contract confirmed), never at app launch.
  - denied/unsupported → returns a status; the caller shows an in-app note ("Reminders off — we'll keep your spot in-app"). No crash.
- `cancelContractReminders(contractId)`: cancels both IDs. Called on reschedule (before re-schedule), cancel, start, completion, and on Home resume reconcile.
- Android action buttons: `createNotificationChannel`/`registerActionTypes` with READY / RESCHEDULE / RESCUE VERSION on the start reminder, behind `Capacitor.isNativePlatform()` + `isPluginAvailable` guard; web skips actions entirely. Tapping the notification deep-links via `localNotificationReceived` → open Home. (RESCHEDULE/RESCUE handled by opening the contract card; no background work promised.)

**2. `src/lib/verified/contract-session.ts`**
- Thin client over existing live RPCs: `start_contract_session(contractId, clientInstanceId)` and `end_contract_session(sessionId, reason)`. No new RPC.
- Timestamp-only timer: `left = expected_end_at − Date.now()`, never tick-counting.
- Checkpoint: `localStorage` key `axen_contract_session` = `{ contractId, sessionId, expectedEndAt, startedAt }` written on start; cleared on end/abandon. On Home mount and on `visibilitychange → visible`, recover: if a checkpoint exists and `expected_end_at` is in the future → restore the overlay; if past → call `end_contract_session` once (idempotent guard: ref) so the contract reaches `proof_pending`.
- Start lock: in-flight ref + disable button, so double-tap START yields one session (RPC is already idempotent via `client_instance_id`).
- End paths mapped to existing states only:
  - timer completes → `end_contract_session(id, "completed")` → contract `proof_pending` (existing RPC behavior).
  - "I'm Stuck" → coach-style nudge sheet + log via `end_contract_session(id, "stuck")`? No — I'm Stuck does NOT end the session; it shows an in-overlay support note and keeps the timer running.
  - End Session → confirm dialog + free-text reason → `end_contract_session(id, reason)` → session `completed`/`abandoned` per RPC, contract handled by existing RPC.
  - Emergency Exit → one tap, confirm, `end_contract_session(id, "emergency_exit")` → session `abandoned`, contract stays `active` so the user can restart. Never hidden, never disabled.

**3. `src/components/verified/ContractFocusSession.tsx`**
- Full-screen overlay reusing the existing `df-*` CSS classes (timer ring, eagle mentor image import, TRACKS list + `<audio>`) — visually identical language to Deep Focus, zero edits to `DeepFocus.tsx`.
- Prefill: contract title, duration from `planned_seconds`, first track selected; sound controls (loop/volume) same pattern.
- Buttons: I'm Stuck · Pause (only shown if contract category allows — no pause flag exists, so Pause shows a disabled-state hint unless you want a pause column later; default: Pause allowed, it only pauses audio, never the timer — the timer is server-timestamp-based) · End Session (confirm + reason) · Emergency Exit (always).
- On completion: hands back "SUBMIT PROOF" entry point placeholder (Phase 4 will wire proof; Phase 3 shows the `proof_pending` state text on the card only — no proof UI built now).

## Modified files (exact changes)

**4. `src/components/verified/ContractCard.tsx`**
- Line ~122: replace the disabled `START CONTRACT` button for `scheduled` with an active button calling `onStart(row)` (new optional prop). Drafts unchanged.
- Add for `active` status: `RETURN TO SESSION` button calling `onResume(row)`.
- Status line: add `proof_pending` → "SESSION DONE — proof step comes next" to the existing `READ_ONLY` map (line ~129 area).
- Cancel path (line ~82 area): also call `cancelContractReminders(row.id)`.
- No visual restyle; same tokens/classes.

**5. `src/tabs/HomeTab.tsx`**
- After the contract card: render `<ContractFocusSession>` when a session/overlay state is active; pass `onStart`/`onResume` handlers into `ContractCard`.
- On contract create/update success (existing handlers): call `scheduleContractReminders(contract)`; on cancel: `cancelContractReminders`.
- On mount + `visibilitychange` visible: run the checkpoint reconcile (cancel reminders for non-scheduled contracts; recover an in-flight session).
- No other Home sections touched.

**6. `src/lib/local-notifications.ts`** — one additive optional field
- `LocalReminder` gains `actionsId?: string`; inside the native branch only, pass `actionTypeId` when set. ~4 lines added, nothing existing changed. All current callers compile unchanged.

## Will not touch
`DeepFocus.tsx`, `ZenTab.tsx`, `ZenMandalaScene.tsx`, `alarm-audio.ts`, `live-audio.ts`, `FocusMusicPanel.tsx`, `RemindersCard.tsx`, `ProfileDetailScreens.tsx`, XP/coins/rewards, proof, recovery, accountability, navigation, any database object, `capacitor.config.ts`.

## Tests (after build)
- DB-side (live, two temp accounts, rolled back): start RPC idempotent on double-call; end → `proof_pending`; emergency abandon leaves contract `active`; cross-user session start/end blocked. All use existing RPCs — no migration.
- App: 20 checks from your list — permission granted/denied paths, reschedule cancels old IDs, restart/reconcile no duplicates, timestamp DST-safe (unit: offset math), double-tap single session, background continues, kill/recover from checkpoint, completion → proof_pending, emergency exit, end-with-reason confirm, Deep Focus standalone unchanged, Zen unchanged, XP/coins unchanged, Home sections intact, nav intact, build + typecheck clean, no console errors.
- Any failure → stop, report, wait.

Rollback: delete the 3 new files, revert the 3 small edits (git diff is small and isolated). No database rollback needed — nothing changes there.

Do not start Phase 4. No merge/publish.
