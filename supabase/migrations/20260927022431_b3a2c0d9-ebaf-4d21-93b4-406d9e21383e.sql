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