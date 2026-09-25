# Phase 3 of 8 — Step 0 Audit (no code written)

Target note: the only database this editor can run against is the live one (as approved for Phases 1–2). Nothing has been changed for Phase 3.

## A) What already exists

1. Deep Focus timer: `src/components/DeepFocus.tsx` — the timer lives inside this one component (phases idle → setup → active → done). It already uses timestamps (`endsAt - Date.now()`) and restores from saved local state key `dwt_focus_session`.
2. Deep Focus screen: same file. There is no separate page; it opens as a full-screen overlay from `src/tabs/HomeTab.tsx`.
3. Notification plugin: `@capacitor/local-notifications` `^8.3.1`, wrapped by `src/lib/local-notifications.ts` (`scheduleLocalReminder`, `cancelLocalReminder`, `stableNotificationId`, `nextReminderAt`, browser-permission fallback on web).
4. Sound engine: no audio library. Plain HTML audio — Deep Focus `<audio>` tracks, `src/lib/alarm-audio.ts`, `src/lib/live-audio.ts`, `src/components/FocusMusicPanel.tsx`.
5. `capacitor.config.ts` plugins: none configured (appId `com.hasin.axen`, server URL only). Native plugins present: local-notifications, RevenueCat.
6. Background handlers: none. No Capacitor `App` plugin, no service worker.
7. Notification ID storage: none stored — IDs are derived on the fly via `stableNotificationId(key)` (hash + 5000 offset).
8. Lifecycle handlers: only browser `visibilitychange`/focus listeners in `wake-plan.ts`, `useEntitlement.ts`, `useSubscription.ts`, `alarm-audio.ts`, `live-audio.ts`, `dashboard.tsx`. No app resume/pause handler.

Database (Phase 1, already live): `start_contract_session`, `end_contract_session` RPCs; contract statuses `draft, scheduled, active, proof_pending, verified, rewarded, missed`; session statuses `active, completed, abandoned, expired`.

## Two conflicts found — need your decision

1. **"interrupted" state does not exist.** Contracts can only go active → proof_pending or missed. Options: (a) record a legitimate exit as session `abandoned` and leave the contract `active` so the user can resume/restart (no database change), or (b) add a new `interrupted` contract status via a small additive migration (shown to you before applying).
2. **Deep Focus cannot be "wrapped" without touching it.** Its timer and overlay are private inside `DeepFocus.tsx` and have no I'm Stuck / Pause / End-with-reason / Emergency Exit buttons. Options: (a) build `ContractFocusSession` as a separate overlay that reuses Deep Focus's look (same CSS classes, ring, eagle mentor, track list) — Deep Focus file untouched; or (b) change `DeepFocus.tsx` (I will not do this without showing exact lines).
   Recommendation: 1(a) or 1(b) your choice; 2(a).

Quiet hours: no existing quiet-hours setting was found in the app. I will not invent one unless you want it.

## B) Planned files (pending your decisions)

New:
- `src/lib/verified/contract-reminders.ts` — prep (−5 min), start, and optional missed-start reminders; IDs from `stableNotificationId("contract:<id>:prep|start|miss")`; cancel-before-schedule; reconcile on resume; Asia/Calcutta via stored contract timezone (absolute UTC instants, so DST-safe).
- `src/lib/verified/contract-session.ts` — calls existing RPCs, timestamp-only timer, local checkpoint key `axen_contract_session`, recovery after restart, double-tap lock.
- `src/components/verified/ContractFocusSession.tsx` — full-screen session (title, timer, progress, sound, I'm Stuck, Pause if allowed, End Session with confirm + reason, Emergency Exit always visible).

Modified (small, additive):
- `src/components/verified/ContractCard.tsx` — enable START CONTRACT (currently disabled, line ~122), add "Return to Session" for active contracts, trigger reminder scheduling after confirm (permission asked here only).
- `src/tabs/HomeTab.tsx` — mount `ContractFocusSession` next to the card; resume reconcile via `visibilitychange`.
- `src/lib/local-notifications.ts` — only if needed: add optional `actionTypeId` (READY / RESCHEDULE / RESCUE) to `LocalReminder`; existing callers unaffected. Exact lines shown in the implementation plan.

Notification action buttons (READY/RESCHEDULE/RESCUE) work on Android only; web gets in-app banner instead.

## C) Will stay untouched

Deep Focus timer and file, Zen (`ZenTab.tsx`, `ZenMandalaScene.tsx`), audio files/libs, existing reminder screens (`RemindersCard.tsx`, `ProfileDetailScreens.tsx`), XP/coins/rewards, proof, recovery, accountability, navigation, other Home sections.

After your approval I will send the exact-lines implementation plan, then build and run the 20 tests, stopping on any failure.
