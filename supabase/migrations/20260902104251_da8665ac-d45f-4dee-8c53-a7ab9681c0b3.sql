-- Internal trigger functions must not be client-callable
REVOKE ALL ON FUNCTION public.sync_profile_subscription() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_profile_economy() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;