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
