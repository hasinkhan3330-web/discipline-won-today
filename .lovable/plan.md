# Rank verification badge and profile list correction

## What will change
- Match the supplied Instagram screenshot's compact verification mark beside each qualifying username: one crisp white check centered in a solid, coin-tier-colored circular badge. Keep the user's photo on the left and display name below the username. The screenshot is a visual reference, not an image to embed.
- No badge or colored avatar ring below 350 coins. At 350–1,049 show pink; 1,050–4,999 green; 5,000–14,499 Instagram-style blue; 14,500–18,249 black; 18,250+ a premium gold circle with 🐐 instead of a check. The check itself stays white in every non-GOAT tier; only the circle and qualifying photo outline change.
- Keep the rank-card dot as the entry to the full-screen profile list, with a top-left X. The list scrolls vertically in both directions, never sideways. Preserve the existing AXEN dark theme; do not reproduce Instagram's light background or Follow buttons.
- Apply the same badge treatment to the Rank tab's own avatar and rank cards, without changing rank positions, DP, coins, or sections below Rank.

## Technical scope
- Adjust only the rank-badge presentation in `src/components/RankCoinBadge.tsx`, its Rank/Leaderboard placement in `src/components/Leaderboard.tsx` and `src/tabs/RankTab.tsx` if needed, and the narrowly scoped `.rank-coin-*` / `.rank-people-*` / rank-dot styles in `src/styles.css`.
- Keep the existing authenticated `rank_verification_badges` lookup and profile coin balance as the authoritative eligibility source; no database or reward changes. The current badge component already maps the five milestone tiers and uses a white SVG check, so first confirm the rendered sizes, positions, colors, and list behavior rather than replacing the eligibility logic.
- Verify all tier boundaries (349/350, 1049/1050, 4999/5000, 14499/14500, 18249/18250), the single white check/GOAT symbol, the dot and X interactions, vertical-only scrolling on mobile, and preview compilation. If live accounts do not span the tiers, use isolated visual fixtures without changing user balances.