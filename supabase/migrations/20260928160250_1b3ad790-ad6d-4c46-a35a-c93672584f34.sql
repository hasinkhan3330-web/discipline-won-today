CREATE OR REPLACE FUNCTION public.rank_verification_badges(_scope text DEFAULT 'india', _period text DEFAULT 'weekly')
RETURNS TABLE(user_id uuid, milestone integer)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $function$
  WITH ranked AS (
    SELECT DISTINCT r.user_id FROM public.leaderboard_top(_scope, _period, 100, 0) AS r
    UNION
    SELECT auth.uid() WHERE auth.uid() IS NOT NULL
  ), earned AS (
    SELECT r.user_id, COALESCE((SELECT SUM(ct.amount) FROM public.coin_transactions ct
       WHERE ct.user_id = r.user_id AND ct.amount > 0), 0) AS coins
    FROM ranked r
  )
  SELECT e.user_id, CASE
    WHEN e.coins >= 18250 THEN 365
    WHEN e.coins >= 14500 THEN 290
    WHEN e.coins >= 5000 THEN 100
    WHEN e.coins >= 1050 THEN 21
    WHEN e.coins >= 350 THEN 7
    ELSE NULL END AS milestone
  FROM earned e WHERE auth.uid() IS NOT NULL AND e.coins >= 350;
$function$;
REVOKE ALL ON FUNCTION public.rank_verification_badges(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rank_verification_badges(text, text) TO authenticated;
REVOKE ALL ON FUNCTION public.rank_coin_badges(text, text) FROM PUBLIC, anon, authenticated;