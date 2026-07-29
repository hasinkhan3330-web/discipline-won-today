REVOKE ALL ON FUNCTION public.complete_alarm(uuid, integer) FROM anon, authenticated, PUBLIC;
REVOKE ALL ON FUNCTION public.has_active_subscription(uuid, text) FROM anon, authenticated, PUBLIC;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon, authenticated, PUBLIC;
REVOKE ALL ON FUNCTION public.guard_profile_economy() FROM anon, authenticated, PUBLIC;
REVOKE ALL ON FUNCTION public.force_app_trial_window() FROM anon, authenticated, PUBLIC;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM anon, authenticated, PUBLIC;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM anon, authenticated, PUBLIC;

REVOKE ALL ON FUNCTION public.complete_task(uuid) FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION public.apply_daily_penalty() FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION public.ensure_app_trial() FROM anon, PUBLIC;

GRANT EXECUTE ON FUNCTION public.complete_task(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_daily_penalty() TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_app_trial() TO authenticated;