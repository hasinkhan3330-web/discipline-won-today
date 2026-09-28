CREATE OR REPLACE FUNCTION public.rank_verification_badges(_scope text DEFAULT 'india', _period text DEFAULT 'weekly')
RETURNS TABLE(user_id uuid, milestone integer)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $function$
  WITH ranked AS (
    SELECT DISTINCT r.user_id FROM public.leaderboard_top(_scope, _period, 100, 0) AS r
    UNION
    SELECT auth.uid() WHERE auth.uid() IS NOT NULL
  )
  SELECT r.user_id, CASE
    WHEN p.coins >= 18250 THEN 365
    WHEN p.coins >= 14500 THEN 290
    WHEN p.coins >= 5000 THEN 100
    WHEN p.coins >= 1050 THEN 21
    WHEN p.coins >= 350 THEN 7
    ELSE NULL END AS milestone
  FROM ranked r JOIN public.profiles p ON p.id = r.user_id
  WHERE auth.uid() IS NOT NULL AND p.coins >= 350;
$function$;
REVOKE ALL ON FUNCTION public.rank_verification_badges(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rank_verification_badges(text, text) TO authenticated;