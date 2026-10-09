CREATE OR REPLACE FUNCTION public.get_verified_rank_coins(_scope text DEFAULT 'india', _period text DEFAULT 'weekly')
RETURNS TABLE(user_id uuid, coins_earned integer, highest_seal_tier text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501'; END IF;
 RETURN QUERY
 WITH tiers(days, threshold, tier) AS (
  VALUES (7,350,'bronze'::text),(21,1050,'silver'),(100,5000,'gold'),(290,14500,'amethyst'),(365,18250,'diamond')
 ), members AS (
  SELECT DISTINCT r.user_id FROM public.leaderboard_top(_scope,_period,100,0) r
 )
 SELECT p.id, coalesce(p.coins,0), (
  SELECT t.tier FROM tiers t
  WHERE coalesce(p.coins,0) >= t.threshold OR EXISTS (
   SELECT 1 FROM public.unlock_rewards u WHERE u.user_id=p.id AND u.reward_key='milestone_seal_' || t.days
  ) ORDER BY t.threshold DESC LIMIT 1
 ) FROM members m JOIN public.profiles p ON p.id=m.user_id;
END $$;
REVOKE ALL ON FUNCTION public.get_verified_rank_coins(text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_verified_rank_coins(text,text) TO authenticated;
COMMENT ON FUNCTION public.get_verified_rank_coins(text,text) IS 'Read-only coin total and permanent highest milestone seal for exactly the existing scoped leaderboard members; no raw seal rows or identity fields.';