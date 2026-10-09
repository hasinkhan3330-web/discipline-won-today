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
- Rank coin badges use the signed-in, leaderboard-scoped `rank_verification_badges` lookup and profile coin balance, not leaderboard DP or client-calculated rewards, so badge thresholds match the displayed coin count without changing ranking.
- Accountability commitments, aggregate partner stats, fixed nudges, emergency alerts, and verified check-ins use the existing authenticated `send_accountability_nudge` RPC, keeping one server-authoritative partner boundary without exposing raw partner rows.

- Partner proof review lives on proof_submissions review columns and the single partner_proof_action RPC; trust is read-only via get_trust_summary. Why: one server-authoritative review path, no parallel tables, rewards untouched.
- Comebacks use guarded server timestamps and one row-locked finalizer, called on app open and by a shared cron armed on start and removed after drain; this keeps closed-app completion durable and rewards exactly once.
- Public identity rendering uses the shared display-name helper and SQL display-name projection, never username/auth fields; this prevents email-prefix disclosure while retaining existing RPC signatures and ranking logic.
- Milestone-circle seals use server-owned milestone_seal_* unlock_rewards records and an isolated SVG component; keeping entitlement separate from streak_* bonuses and shared name/Rank badges prevents reward and visual regressions.
- The Rank dashboard mounts RankTab in sections-only mode below Leaderboard; reuse its existing progression, reward and navigation logic without duplicating profile headers or restoring the removed inline member list.
