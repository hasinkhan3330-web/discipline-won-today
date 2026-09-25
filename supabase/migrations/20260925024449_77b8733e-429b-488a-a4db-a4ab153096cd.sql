CREATE OR REPLACE FUNCTION public.finalize_contract_and_award(_contract_id uuid)
RETURNS TABLE(result text, xp integer, coins integer, coin_balance integer, xp_total integer)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $$
DECLARE
  _uid uuid := auth.uid();
  _r record;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;
  IF _contract_id IS NULL THEN
    RAISE EXCEPTION 'contract not found' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO _r FROM public.award_contract(_contract_id);

  RETURN QUERY
  SELECT CASE WHEN _r.already_awarded THEN 'already_rewarded' ELSE 'awarded' END,
         _r.xp, _r.coins,
         (SELECT p.coins FROM public.profiles p WHERE p.id = _uid),
         (SELECT coalesce(sum(s.points), 0)::int FROM public.score_events s WHERE s.user_id = _uid);
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_contract_and_award(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finalize_contract_and_award(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.finalize_contract_and_award(uuid) TO authenticated;