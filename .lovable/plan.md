# Rank photo verification badges

## What changes
- On the Rank leaderboard, put one prominent, metallic circular check directly below each qualifying person's profile photo. Use the uploaded blue badge as a visual reference, not as a pasted image. The highest earned badge is shown: 7 days + 350 earned coins = yellow; 21 + 1,050 = green; 100 + 5,000 = blue; 290 + 14,500 = red; 365 + 18,250 = dark-blue diamond. No badge before both requirements are satisfied. Show no milestone number inside the badge; retain existing DP numbers and streak labels in their current places.
- Give the Rank profile photo the same badge treatment; remove its duplicate tiny badge beside the name on Rank only. Do not modify Profile or Stats files. Their existing badges already appear there; removing them conflicts with the explicit instruction not to touch those tabs and requires a separate decision.
- Badge is visual recognition, not a new reward. No XP/coin payouts or balance changes.

## Exact files and lines
- `src/components/Leaderboard.tsx` lines 10–20, 80–90, 219–225 and 244–250: receive only an earned badge tier for each visible leaderboard member; display the check at the lower center of the photo for podium and ranks 4–100. Preserve all ranking data, DP, filters, ordering and privacy.
- `src/tabs/RankTab.tsx` lines 85 and 100–103: center the earned badge below the signed-in person's photo, without duplicating it by their name.
- `src/components/StreakBadge.tsx` lines 3–9 and `src/styles.css` lines 2800–2818 plus scoped Rank/leaderboard styling near lines 2136–2139 and 2659–2666: make a detailed metallic rim, embossed check, colored inner enamel and restrained shine; respect reduced motion and small screens.
- `src/routes/_authenticated/dashboard.tsx` lines 998–1021: pass the signed-in earned tier to Rank from the server result; no change to navigation or other tabs.
- One **new read-only database function** in a new migration: return only qualifying badge tiers for the existing top 100 in the selected region and period plus the requesting user, calculated from the lesser of verified consecutive completion history and protected profile streak and the sum of positive coin earnings. Do not expose anyone's coin totals or history. Secure it for authenticated callers, with pinned search path. Show SQL before any database application; no production migration runs without explicit approval.

## Verification and limits
- Test every threshold, highest-tier selection, below-threshold refusal, and no duplicate badge; check mobile and desktop photo placement, filters and reduced motion. No claim that a coin balance alone proves earned coins.
- Existing routes, auth, rewards, theme, Zen, Deep Focus, Profile, Stats, and leaderboard ranking logic stay unchanged. No publishing or production promotion. The prior physical 4AM Android selfie test is still outstanding and is not part of this badge request.

## SQL for first approval — NOT APPLIED
This creates only a read-only function. It calls the existing leaderboard function for the selected top 100, adds the signed-in person so their own Rank badge can appear even if unranked, and returns only each eligible person's ID and highest tier. The coin condition is **lifetime positive coins earned**, not current spendable balance or leaderboard DP. It checks the recorded streak against actual consecutive completion days, matching the existing reward guard. No tables, reward functions, ranking formulas, payouts or existing rows are changed.

```sql
CREATE OR REPLACE FUNCTION public.rank_verification_badges(
  _scope text DEFAULT 'india',
  _period text DEFAULT 'weekly'
)
RETURNS TABLE(user_id uuid, milestone integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  WITH ranked AS (
    SELECT DISTINCT r.user_id
    FROM public.leaderboard_top(_scope, _period, 100, 0) AS r
    UNION
    SELECT auth.uid() WHERE auth.uid() IS NOT NULL
  ),
  eligible AS (
    SELECT r.user_id,
           LEAST(
             GREATEST(p.streak, p.longest_streak),
             public.axen_real_best_streak(r.user_id)
           ) AS verified_days,
           COALESCE((
             SELECT SUM(ct.amount)
             FROM public.coin_transactions AS ct
             WHERE ct.user_id = r.user_id AND ct.amount > 0
           ), 0) AS earned_coins
    FROM ranked AS r
    JOIN public.profiles AS p ON p.id = r.user_id
  )
  SELECT e.user_id,
         CASE
           WHEN e.verified_days >= 365 AND e.earned_coins >= 18250 THEN 365
           WHEN e.verified_days >= 290 AND e.earned_coins >= 14500 THEN 290
           WHEN e.verified_days >= 100 AND e.earned_coins >= 5000 THEN 100
           WHEN e.verified_days >= 21 AND e.earned_coins >= 1050 THEN 21
           WHEN e.verified_days >= 7 AND e.earned_coins >= 350 THEN 7
         END AS milestone
  FROM eligible AS e
  WHERE e.verified_days >= 7 AND e.earned_coins >= 350;
$function$;

REVOKE ALL ON FUNCTION public.rank_verification_badges(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rank_verification_badges(text, text) TO authenticated;
```

**Approval gates:** First approve this SQL. Only then will I show the exact proposed file changes and wait for a **second approval** before editing app files. No SQL or file implementation has run yet.
