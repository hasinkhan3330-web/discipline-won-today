CREATE OR REPLACE FUNCTION public.award_contract(_contract_id uuid)
RETURNS TABLE(xp integer, coins integer, already_awarded boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _uid uuid := auth.uid();
  _c   public.daily_contracts;
  _xp  integer;
  _co  integer;
  _key text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501'; END IF;
  SELECT * INTO _c FROM public.daily_contracts WHERE id = _contract_id AND user_id = _uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'contract not found' USING ERRCODE = '42501'; END IF;
  IF _c.status = 'rewarded' THEN
    RETURN QUERY SELECT _c.xp_awarded, _c.coins_awarded, true; RETURN;
  END IF;
  IF _c.status <> 'verified' THEN RAISE EXCEPTION 'contract not verified' USING ERRCODE = '22023'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.proof_submissions p
                 WHERE p.contract_id = _c.id AND p.user_id = _uid AND p.status = 'verified') THEN
    RAISE EXCEPTION 'no verified proof' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.contract_sessions s
                 WHERE s.contract_id = _c.id AND s.user_id = _uid AND s.session_status = 'completed') THEN
    RAISE EXCEPTION 'no completed session' USING ERRCODE = '22023';
  END IF;

  _xp := CASE WHEN _c.is_recovery THEN 8 ELSE 20 END;
  _co := CASE WHEN _c.is_recovery THEN 2 ELSE 5 END;
  _key := 'contract:' || _c.id::text;

  PERFORM pg_catalog.set_config('axen.contract_write', 'on', true);
  PERFORM pg_catalog.set_config('app.economy_write', 'on', true);

  INSERT INTO public.score_events(user_id, points, kind, idempotency_key)
  VALUES (_uid, _xp, CASE WHEN _c.is_recovery THEN 'contract_recovery' ELSE 'contract_verified' END, _key)
  ON CONFLICT (idempotency_key) DO NOTHING;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'reward ledger conflict' USING ERRCODE = '23505';
  END IF;
  INSERT INTO public.coin_transactions(user_id, amount, reason, ref_id)
  VALUES (_uid, _co, 'contract_reward', _c.id);
  UPDATE public.profiles AS p SET coins = p.coins + _co WHERE p.id = _uid;

  UPDATE public.daily_contracts
     SET status = 'rewarded', xp_awarded = _xp, coins_awarded = _co, rewarded_at = now()
   WHERE id = _c.id;
  PERFORM public.log_contract_event(_c.id, _uid, 'rewarded', 'verified', 'rewarded',
    pg_catalog.jsonb_build_object('xp', _xp, 'coins', _co));
  RETURN QUERY SELECT _xp, _co, false;
END;
$$;
REVOKE ALL ON FUNCTION public.award_contract(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.award_contract(uuid) TO authenticated;