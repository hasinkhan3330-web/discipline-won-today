# Rank photo verification badges

## What changes
- On the Rank leaderboard, put one prominent, metallic circular check directly below each qualifying person's profile photo. Use the uploaded blue badge as a visual reference, not as a pasted image. The highest earned badge is shown: 7 days + 350 earned coins = yellow; 21 + 1,050 = green; 100 + 5,000 = blue; 290 + 14,500 = red; 365 + 18,250 = dark-blue diamond. No badge before both requirements are satisfied. Show no milestone number inside the badge; retain existing DP numbers and streak labels in their current places.
- Give the Rank profile photo the same badge treatment; remove its duplicate tiny badge beside the name on Rank only. Leave Profile and Stats unchanged.
- Badge is visual recognition, not a new reward. No XP/coin payouts or balance changes.

## Exact files and lines
- `src/components/Leaderboard.tsx` lines 10–20, 80–90, 219–225 and 244–250: receive only an earned badge tier for each visible leaderboard member; display the check at the lower center of the photo for podium and ranks 4–100. Preserve all ranking data, DP, filters, ordering and privacy.
- `src/tabs/RankTab.tsx` lines 85 and 100–103: center the earned badge below the signed-in person's photo, without duplicating it by their name.
- `src/components/StreakBadge.tsx` lines 3–9 and `src/styles.css` lines 2800–2818 plus scoped Rank/leaderboard styling near lines 2136–2139 and 2659–2666: make a detailed metallic rim, embossed check, colored inner enamel and restrained shine; respect reduced motion and small screens.
- `src/routes/_authenticated/dashboard.tsx` lines 998–1021: pass the signed-in earned tier to Rank from the server result; no change to navigation or other tabs.
- One **new read-only database function** in a new migration: return only qualifying badge tiers for up to the visible leaderboard members, calculated from server-owned consecutive completion history and earned coin ledger. Do not expose anyone's coin totals or history. Secure it for authenticated callers, with pinned search path. The exact SQL will be shown separately before any database application; no production migration runs without explicit approval.

## Verification and limits
- Test every threshold, highest-tier selection, below-threshold refusal, and no duplicate badge; check mobile and desktop photo placement, filters and reduced motion. No claim that a coin balance alone proves earned coins.
- Existing routes, auth, rewards, theme, Zen, Deep Focus, Profile, Stats, and leaderboard ranking logic stay unchanged. No publishing or production promotion. The prior physical 4AM Android selfie test is still outstanding and is not part of this badge request.
