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
