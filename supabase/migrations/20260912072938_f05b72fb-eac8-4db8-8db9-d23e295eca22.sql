REVOKE ALL ON FUNCTION public.get_pact_status() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rank_scan() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_pact_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.rank_scan() TO authenticated;