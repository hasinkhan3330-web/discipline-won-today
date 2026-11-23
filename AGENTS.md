<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Wake Protocol completion uses the existing math/science alarm challenge with no camera or selfie verification, preserving user privacy and the established alarm experience.
- Wake alarms use a server-owned occurrence and private question state behind an AlarmScheduler adapter; only verified server solves finalize the existing wake session and coin ledger, preventing client timing/answer bypasses.
- Wake science uses the existing private quiz rows with wake-only category/source metadata; the server-only bank is never imported by browser modules, so answer keys stay private.
- Wake push delivery remains explicitly inactive until the new authenticated-secret callback is published and its scheduler is activated; subscription alone never implies closed-app readiness.
- Wake private tables grant nothing to anon/authenticated and are reached only via SECURITY DEFINER functions; push bodies come from the `wakePushMessage` allowlist; offline server answers queue in memory only. Why: defense in depth, so no answer data reaches the device.
- Rank coin badges use the signed-in, leaderboard-scoped `rank_verification_badges` lookup and profile coin balance, not leaderboard DP or client-calculated rewards, so badge thresholds match the displayed coin count without changing ranking.
- Accountability commitments, aggregate partner stats, fixed nudges, emergency alerts, and verified check-ins use the existing authenticated `send_accountability_nudge` RPC, keeping one server-authoritative partner boundary without exposing raw partner rows.

- Partner proof review lives on proof_submissions review columns and the single partner_proof_action RPC; trust is read-only via get_trust_summary. Why: one server-authoritative review path, no parallel tables, rewards untouched.
- Comebacks use guarded server timestamps and one row-locked finalizer, called on app open and by a shared cron armed on start and removed after drain; this keeps closed-app completion durable and rewards exactly once.
- Public identity rendering uses the shared display-name helper and SQL display-name projection, never username/auth fields; this prevents email-prefix disclosure while retaining existing RPC signatures and ranking logic.
- Stats and Rank reuse MilestoneSeal SVG artwork; the verified member list reads the authenticated scoped get_verified_rank_coins projection for coins and permanent highest seals, while other Rank surfaces retain rank_verification_badges. Why: preserve existing ranking and owner-only seal access without exposing private rows.
- The Rank dashboard mounts RankTab in sections-only mode below Leaderboard; reuse its existing progression, reward and navigation logic without duplicating profile headers or restoring the removed inline member list.
- Contract card and New/Edit sheet visuals use a Contract-only CSS module and controls; isolation prevents style changes from reaching shared components or other screens.
- Rank content uses the shared ProtectedFeatureGate around Leaderboard and RankTab; the existing server entitlement verdict preserves subscription/trial access and blocks Basic or expired access.
- Zen presentation uses Zen-only components and a CSS module, reading existing meditation/audio/settings state; scoped wrapper overrides and font loading keep other screens and shared controls unchanged.

- Completion coin rewards reuse the existing ledger and balance through private serialized award logic; stored reward timezone and scoped unique keys prevent daily replay without changing XP/recovery.
- Coin amounts use the scoped CoinBadge and animate only server-confirmed award identities; no global theme or shared controls are restyled.


- Text and voice Coach share one 9-tool set (`COACH_TOOL_DEFS` / `runCoachTool`); voice adapts it in `coach-voice-tools.ts` and runs tool calls server-side. Why: one server-authoritative action path, no mark-done or coin tools.
- Voice sessions hand the browser only ephemeral Gemini tokens, and the full Live setup (system instruction with <user_profile>, tools, transcription) is built on the server and baked into the token. Why: keys must not reach the client, and Google ignores client setup fields not in the token.
- Coach quick setup saves owner-scoped profile slots without inference; voice tool batches are serialized and notify the shared plan panel after writes. Why: prevent overlapping profile writes and stale confidence.
- Coach "knows you %" comes only from getProfileCompleteness over coach_profile slots; every text/voice session gets a server-built <user_profile> block (re-fetched on reconnect). Why: UI and Coach must never disagree or trust a client percent.
- Wake missions Shake/Typing/Tiles reuse `alarms.challenge_type`, the existing AlarmScreen ringing path and a private `wake_finalize_solve` copied from `wake_submit_answer`; only `wake_complete_mission` (proof plausibility checks) can finish them. Why: one alarm engine and identical rewards, Math/Science untouched.
- Coach tab UI is switched by `USE_ORB_COACH` (coach-config); the orb screen reads VoiceCoach state/levels through its render prop and analyser side-branches only. Why: the old UI can be restored and voice/audio stay untouched.
- Coach plans are saved only through the model tool `save_plan` into `plan_tasks` (atomic `save_plan_tasks` SECURITY INVOKER function, user from auth.uid()); `create_plan_draft`/`confirm_plan` stay button-only, and confirm also writes plan_tasks. Why: one persistence path that My Plan reads, so the coach can never claim an unsaved plan.
- Accountability home shows only data its existing queries already return; elements without real data are hidden, and partner online presence stays off until a persisted opt-out setting exists. Why: no faked signals and no presence without a saved privacy choice.
- Partner nudge/cheer history lives in `partner_events`, written only by fail-safe AFTER INSERT triggers on `accountability_events`/`acct_cheers`; clients get SELECT + UPDATE(seen_at) only. Why: existing send functions, limits and mute stay untouched and history can never block a send.
- `/join/$code` never validates a code for signed-out visitors and never auto-accepts; the existing `acceptInvite` runs only when the signed-in user taps Join. Why: no data exposure and explicit consent.
- Partner proof files live in private bucket `proofs` at `{user_id}/...`; partner read requires a matching proof_submissions row and `is_active_partner()`. Why: folder match alone could leak unsubmitted files.
- Pact create/edit/pause/cancel go through `save_pact` (column whitelist, client uuid for idempotency), `set_pact_pause`, `cancel_pact`; existing daily_contracts triggers still enforce rules. Why: prepare revoking direct client writes without duplicating lifecycle logic.
- Nudges and emergencies are sent only via `send_nudge(template_id, pact_id)` from server `nudge_templates`; limits count from `accountability_events`; old `send_accountability_nudge` handles only details/checkin/commitment; parties keep their own `partner_events` history after removal. Why: template-only, server-enforced, one history source.
- Nudge suggestions come only from `get_nudge_suggestions()`; new templates seed inactive. Why: no raw partner data, owner approves copy.
- Coin decay: cron + `apply_daily_penalty()` call `axen_apply_coin_decay` (PK user_id+local_day); <15 earned → −3, no floor. Why: one idempotent rule.
- Home personal tasks capped at 5 by `enforce_task_limit` (per-user advisory lock; Coach-registry/archived rows excluded); `coach_plan_materialized` is server-only; `complete_task` and the task_completions guard reject Coach/archived tasks. Why: block Home reward abuse; archiving reversible via `archived_prev_active`.
- Landing at `/` shows only to signed-out web visitors after the session check; native, OAuth callbacks and invites skip it; buttons open the existing sign-in. Styles `axl-`. Why: no marketing flash over auth.
- 12-question Setup opens from You → Setup, not Home. Why: keeps onboarding reachable.
- Component CSS: `*.module.css` bound imports (`:global()` hooks), never side-effect `.css` imports. Why: those never load in preview.
- Wake coins/XP end 07:30 local, server clock. Why: no bypass.
- Accountability is Pro/trial-only: ProtectedFeatureGate on screens + get_entitlement guard in its RPCs and restrictive RLS; pacts stay open. Why: no bypass, Contract unaffected.
