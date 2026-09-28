CREATE OR REPLACE FUNCTION public.rank_coin_badges(_scope text DEFAULT 'india', _period text DEFAULT 'weekly')
RETURNS TABLE(user_id uuid, earned_coins bigint)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $function$
  WITH ranked AS (
    SELECT DISTINCT r.user_id FROM public.leaderboard_top(_scope, _period, 100, 0) AS r
    UNION
    SELECT auth.uid() WHERE auth.uid() IS NOT NULL
  )
  SELECT r.user_id,
         COALESCE((SELECT SUM(ct.amount)::bigint FROM public.coin_transactions AS ct
                   WHERE ct.user_id = r.user_id AND ct.amount > 0), 0::bigint) AS earned_coins
  FROM ranked AS r
  WHERE auth.uid() IS NOT NULL;
$function$;
REVOKE ALL ON FUNCTION public.rank_coin_badges(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rank_coin_badges(text, text) TO authenticated;