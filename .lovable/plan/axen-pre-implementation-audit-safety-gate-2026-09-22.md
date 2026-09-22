# AXEN — Pre-Implementation Audit & Safety Gate

Audit only. Nothing was changed: no code, no database, no policies, no deploys.

## A. Existing architecture (verified by inspection)

- **Framework**: TanStack Start v1 (React 19, Vite), file routes in `src/routes`. No `src/pages`, no React Router.
- **Routes**: public `index`, `pro`, `privacy`, `terms`, `refund`, `auth.forgot`, `auth.verified`, `reset-password`; gated subtree `_authenticated/` (`route.tsx` gate + `dashboard.tsx` + `checkout.success`); public API route `api/public/payments/revenuecat-webhook.ts`; MCP routes.
- **Main app surface**: one very large screen, `src/routes/_authenticated/dashboard.tsx` (~64k chars), hosting tabs `HomeTab`, `StatsTab`, `RankTab`, `ZenTab`, `ProfileTab` and components `DeepFocus`, `AiCoach`/`VoiceCoach`, `Leaderboard`, `WakeProtocol`, `TaskVerify`, `RemindersCard`, `GoalHabitPicker`, `AccountabilityPanel`.
- **Backend**: Lovable Cloud (Supabase). **No Edge Functions exist** — all server logic is TanStack server functions (`src/utils/*.functions.ts`, `src/lib/*.functions.ts`) plus SECURITY DEFINER database functions.
- **Auth**: Supabase session client-side; server functions authenticate through the generated `requireSupabaseAuth` middleware (bearer token → `context.supabase`, `context.userId`), with `attachSupabaseAuth` registered in `src/start.ts`.
- **Database**: 63 migrations. Every table in the public schema has RLS enabled (verified — zero tables without it). Rewards run through SECURITY DEFINER RPCs (`complete_task`, `complete_focus_session`, `complete_zen_session`, `complete_top_task`, `complete_alarm`, `complete_wake_protocol`), with a coin ledger (`coin_transactions`), `score_events` with an idempotency key, and economy-write guard triggers.
- **Storage**: one bucket, `avatars`, private.
- **Mobile**: Capacitor 7, Android only — **there is no iOS project in the repo**. Installed plugins: `@capacitor/android`, `@capacitor/core`, `@capacitor/local-notifications`, `@revenuecat/purchases-capacitor`. Manifest declares only `INTERNET` and `BILLING` — no notification, alarm, boot, or foreground-service permissions. The shell loads the hosted site over HTTPS (`capacitor.config.ts` server URL), so web changes ship without a new build.
- **Notifications**: `src/lib/local-notifications.ts` — single-shot local notification scheduling with a browser `Notification` fallback; no rescheduling service, no boot receiver.
- **Proof/vision**: Roboflow hosted `coco/9` via `src/utils/roboflow.functions.ts`; only the 80 COCO labels are detectable.
- **Billing/entitlement**: RevenueCat + `get_entitlement` RPC + `useEntitlement`/`EntitlementProvider` + `ProtectedFeatureGate`.

## B. Compatibility findings

Reuse rather than rebuild:

| Need in the new system | Existing asset to extend |
| --- | --- |
| Rewards/XP | `coin_transactions` + `score_events` + existing `complete_*` RPCs |
| Timer engine | `DeepFocus` session state machine + `focus_sessions` (has `session_token`, `started_at`, `ended_at`) |
| Reminders | `habit_reminders` (has weekdays, timezone, snooze, `notification_id`, `scheduling_status`) + `local-notifications.ts` |
| Proof | `vision_verifications` + `roboflow.functions.ts` + `TaskVerify`/`PhotoProof` |
| Accountability | `accountability_pacts`, `pact_nudges`, `friendships` |
| Recovery/shield | `streak_shield_uses`, `profiles.shields`, `use_streak_shield` |
| Auth on server | `requireSupabaseAuth` middleware |
| Paid gating | `get_entitlement` + `ProtectedFeatureGate` |

Hard limits to design around:
- No iOS project exists: any iOS requirement is out of scope until `cap add ios` is run and tested on a real device.
- Android cannot block other apps without accessibility/usage-access permissions and a foreground service. Current setup has none. Honest "commitment lock" UX only.
- Background execution and exact alarms are not guaranteed: Android 12+ needs `SCHEDULE_EXACT_ALARM`, Android 13+ needs `POST_NOTIFICATIONS`, OEM battery managers still kill schedules, and app termination clears in-app timers.
- `avatars` is the only bucket; image proof would need a new private bucket with owner-scoped policies.
- The remote-URL shell means web-only changes go live on publish — good for rollout, but also means a bad deploy hits installed apps immediately.

## C. Risk map

**Critical**
1. Client-trusted rewards. Any new "verified" reward path must be a SECURITY DEFINER RPC with a unique idempotency key, never a client insert.
2. Proof replay — reusing an old photo/detection. Needs server-side session binding plus a one-proof-per-session unique constraint.
3. Partner data leakage. Accountability reads must go through SECURITY DEFINER functions that return only agreed fields, never raw table reads.

**High**
4. Duplicate sessions / double completion under race (rapid taps, reconnects) — needs a partial unique index on active sessions.
5. Notification reliability on Android without new permissions and a rescheduler.
6. Timezone/DST: reminders store a timezone, but the alarm/next-occurrence path must recompute per local day, not by adding 24h.
7. Editing `dashboard.tsx` at 64k chars is itself a regression risk; new work belongs in isolated components.

**Medium**
8. Roboflow/AI outages — must degrade to a pending/manual state, never silently award or silently fail.
9. Offline writes — no offline queue exists today; new flows must be online-verified with clear retry.
10. New storage bucket privacy and signed-URL lifetime.

**Low**
11. Pre-existing lint warnings on SECURITY DEFINER execute grants (26 items) — known, unrelated.
12. Bundle size warnings.

## D. Impact map

**Likely to change (small, additive)**
- `src/routes/_authenticated/dashboard.tsx` — mount points and props only.
- `src/tabs/HomeTab.tsx` — entry card for the new system.
- `src/styles.css` — new scoped class block only, no token or global edits.
- `android/app/src/main/AndroidManifest.xml` + `capacitor.config.ts` — only if reliable reminders are in scope (new permissions).

**Must NOT change**
- `src/integrations/supabase/*` (generated), `src/start.ts` middleware array, `src/router.tsx`, `src/routes/_authenticated/route.tsx` auth gate, existing `complete_*` RPCs, `profiles` economy columns, existing RLS policies, existing migrations, `com.hasin.axen` package identity, RevenueCat webhook.

**New isolated pieces (only when the spec lands)**
- A `src/components/verified/` folder for contract, session, proof and review UI.
- One `*.functions.ts` module for server verification, one `*.server.ts` for helpers.
- New tables only where no existing table fits: contracts, contract events, proofs. Sessions should extend `focus_sessions`; XP must reuse `coin_transactions`/`score_events`; recovery should reuse the shield tables.

**Rollback strategy**: additive tables and additive RPCs only, feature flagged off by default; a revert of the frontend commit fully disables the feature without touching existing data.

## E. Phased plan (gate after every phase)

1. Architecture + schema foundation (tables, indexes, RLS, grants) — no UI.
2. Contract system (create/read/cancel) behind a flag.
3. Reminder + focus session binding on top of existing engines.
4. Proof capture and storage.
5. Server verification + idempotent reward award.
6. Recovery path.
7. Accountability + optional shield.
8. Staging validation, Android device testing, production rollout.

Each gate: build + typecheck, security review of new RLS/grants, device check where mobile is touched, then your approval before the next phase.

## F. Security/RLS plan (to apply later)

Every new table: `CREATE TABLE` → `GRANT` for `authenticated` (+ `service_role`) → `ENABLE ROW LEVEL SECURITY` → owner-only policies keyed on `auth.uid()`. Reward-bearing columns get a protective trigger like the existing Top 3 Missions guard. Partner visibility only via SECURITY DEFINER functions. Proof bucket private, owner-scoped path prefix, short-lived signed URLs.

## G. Android/iOS plan

Android: add `POST_NOTIFICATIONS` and (if exact timing is required) `SCHEDULE_EXACT_ALARM` plus a reschedule-on-launch pass; document that OEM battery savers can still delay reminders. iOS: not possible today — no iOS project; would need `cap add ios`, a Mac, and device testing before any iOS claim. No app blocking will be promised on either platform.

## H. Testing and rollback

Server-function tests for idempotency and replay, SQL checks that duplicate awards fail, Playwright runs at 360px for the new flows, a real Android build for anything touching notifications. Rollback = disable the flag, then revert the frontend; data tables stay untouched.

## I. Requirements that will need adaptation

Anything in the coming spec that assumes: app blocking, guaranteed background execution, guaranteed exact alarms, iOS parity, a new XP or coin system, or client-computed rewards. Each will be mapped to the existing system or flagged as not guaranteeable.

## J. Verdict

**READY FOR MASTER PROMPT** — with two caveats to acknowledge up front: iOS is not present in this project, and Android app blocking / guaranteed background timing cannot be delivered with the current native setup.
