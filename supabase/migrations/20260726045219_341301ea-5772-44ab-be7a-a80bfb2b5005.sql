-- 1. Remove permissive leaderboard policy on profiles
DROP POLICY IF EXISTS "Public can view leaderboard profiles" ON public.profiles;

-- 2. Ensure public_profiles view is readable for leaderboard
GRANT SELECT ON public.public_profiles TO authenticated, anon;

-- 3. Lock down SECURITY DEFINER functions
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_active_subscription(uuid, text) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.complete_task(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.complete_alarm(uuid, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.apply_daily_penalty() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.complete_task(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_alarm(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_daily_penalty() TO authenticated;