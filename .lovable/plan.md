# Rank verification list — final replacement

## What will change
- Replace only the Rank/Leaderboard presentation: remove the podium, oversized rank cards, old badge look, and Rank-specific moving/decorative animations. Rank positions, DP, coins, navigation, and all other tabs stay untouched.
- Rank shows one simple, clean AXEN-style right arrow (no 3-dot button). Tapping it opens the full-screen Verified Rank List on a clean white background (white only inside this list; the rest of AXEN keeps its existing theme). Top-left X/back closes it. Scrolling is vertical only — no horizontal scroll, carousel, or swipe.
- Each row is minimal and Instagram-inspired with small AXEN touches: circular real profile photo on the left, username immediately followed by the small verification badge, display name below. No Instagram logo/branding, Follow buttons, followers/following counts, posts, likes, bio, social stats, square photos, profile cards, or podium. Profiles and badges are completely static.

## Final badge rules (authoritative)
- 0–349 coins: no badge.
- 350–1,049: pink circle + white check.
- 1,050–14,499: green circle + white check (5,000 causes absolutely no visual change; it stays green).
- 14,500–18,249: red circle + white check.
- 18,250+: dark-blue diamond + white check.
- The check is always white; badges switch automatically at exactly 350, 1,050, 14,500 and 18,250.

## Technical scope
- Keep the existing authenticated `rank_verification_badges` lookup and real profile coin balance as the source of truth; map its milestones to the final tiers (350→pink, 1,050 and 5,000→green, 14,500→red, 18,250→diamond). No database structure, coin/reward, XP, or ranking changes; users can never grant or change their own badge.
- Edit only `src/components/RankCoinBadge.tsx`, `src/components/Leaderboard.tsx`, `src/tabs/RankTab.tsx` (if needed for the entry control), and the scoped `.rank-coin-*` / `.rank-people-*` styles in `src/styles.css`.
- Verify boundaries 349/350, 1,049/1,050, 14,499/14,500, 18,249/18,250 and that 4,999/5,000 render identically in green; check white marks, circular photos, static UI, arrow/X interaction, white background, mobile layout, vertical-only scrolling on a phone-sized viewport, and clean compilation. Use isolated visual fixtures where needed; never modify real user balances.
