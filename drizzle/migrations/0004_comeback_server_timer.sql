ALTER TABLE public.daily_contracts ADD COLUMN IF NOT EXISTS comeback_started_at timestamptz, ADD COLUMN IF NOT EXISTS comeback_ends_at timestamptz;
CREATE INDEX IF NOT EXISTS daily_contracts_comeback_due_idx ON public.daily_contracts(comeback_ends_at) WHERE is_recovery AND status = 'active';

CREATE OR REPLACE FUNCTION public.guard_comeback_fields() RETURNS trigger LANGUAGE plpgsql SET search_path TO '' AS $$
BEGIN
  IF public.axen_is_server_write() THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.comeback_started_at IS NOT NULL OR NEW.comeback_ends_at IS NOT NULL THEN
      RAISE EXCEPTION 'server-only fields cannot be set by client' USING ERRCODE = '42501'; END IF;
  ELSIF NEW.comeback_started_at IS DISTINCT FROM OLD.comeback_started_at OR NEW.comeback_ends_at IS DISTINCT FROM OLD.comeback_ends_at THEN
    RAISE EXCEPTION 'server-only fields cannot be set by client' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_guard_comeback_fields ON public.daily_contracts;
CREATE TRIGGER trg_guard_comeback_fields BEFORE INSERT OR UPDATE ON public.daily_contracts FOR EACH ROW EXECUTE FUNCTION public.guard_comeback_fields();

-- Internal: finalize one due comeback exactly once. Not callable by clients.
CREATE OR REPLACE FUNCTION public.axen_finalize_comeback(_contract_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE _c public.daily_contracts; _xp integer := 8; _co integer; _key text;
BEGIN
  SELECT * INTO _c FROM public.daily_contracts WHERE id = _contract_id FOR UPDATE;
  IF NOT FOUND OR NOT _c.is_recovery OR _c.status <> 'active'
     OR _c.comeback_ends_at IS NULL OR _c.comeback_ends_at > now() THEN RETURN false; END IF;
  PERFORM pg_catalog.set_config('axen.contract_write', 'on', true);
  PERFORM pg_catalog.set_config('app.economy_write', 'on', true);
  UPDATE public.contract_sessions SET ended_at = _c.comeback_ends_at,
      elapsed_seconds = EXTRACT(EPOCH FROM (_c.comeback_ends_at - started_at))::integer,
      exit_reason = 'completed', session_status = 'completed'
   WHERE contract_id = _c.id AND session_status = 'active';
  _key := 'contract:' || _c.id::text;
  INSERT INTO public.score_events(user_id, points, kind, idempotency_key)
  VALUES (_c.user_id, _xp, 'contract_recovery', _key) ON CONFLICT (idempotency_key) DO NOTHING;
  IF FOUND THEN
    _co := LEAST(2, public.axen_daily_coin_room(_c.user_id));
    IF _co > 0 THEN
      INSERT INTO public.coin_transactions(user_id, amount, reason, ref_id) VALUES (_c.user_id, _co, 'contract_reward', _c.id);
      UPDATE public.profiles AS p SET coins = p.coins + _co WHERE p.id = _c.user_id;
    END IF;
  ELSE _xp := 0; _co := 0; END IF;
  UPDATE public.daily_contracts SET status = 'rewarded', completed_at = _c.comeback_ends_at,
      xp_awarded = _xp, coins_awarded = COALESCE(_co, 0), rewarded_at = now() WHERE id = _c.id;
  PERFORM public.log_contract_event(_c.id, _c.user_id, 'rewarded', 'active', 'rewarded',
    pg_catalog.jsonb_build_object('xp', _xp, 'coins', COALESCE(_co,0), 'comeback', true));
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.axen_finalize_comeback(uuid) FROM PUBLIC, anon, authenticated;

-- App-open check: finalize the caller's own due comebacks.
CREATE OR REPLACE FUNCTION public.check_my_comebacks() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE _uid uuid := auth.uid(); _id uuid; _n integer := 0;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501'; END IF;
  FOR _id IN SELECT id FROM public.daily_contracts WHERE user_id = _uid AND is_recovery AND status = 'active' AND comeback_ends_at <= now() LOOP
    IF public.axen_finalize_comeback(_id) THEN _n := _n + 1; END IF;
  END LOOP;
  RETURN _n;
END $$;
REVOKE ALL ON FUNCTION public.check_my_comebacks() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_my_comebacks() TO authenticated;

-- Scheduled sweep for everyone (cron only).
CREATE OR REPLACE FUNCTION public.sweep_due_comebacks() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE _id uuid; _n integer := 0;
BEGIN
  FOR _id IN SELECT id FROM public.daily_contracts WHERE is_recovery AND status = 'active' AND comeback_ends_at <= now() LIMIT 500 LOOP
    IF public.axen_finalize_comeback(_id) THEN _n := _n + 1; END IF;
  END LOOP;
  RETURN _n;
END $$;
REVOKE ALL ON FUNCTION public.sweep_due_comebacks() FROM PUBLIC, anon, authenticated;

-- Start: record server timer for comebacks.
CREATE OR REPLACE FUNCTION public.start_contract_session(_contract_id uuid, _client_instance text DEFAULT NULL::text)
 RETURNS contract_sessions LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
DECLARE _uid uuid := auth.uid(); _c public.daily_contracts; _s public.contract_sessions;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501'; END IF;
  SELECT * INTO _c FROM public.daily_contracts WHERE id = _contract_id AND user_id = _uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'contract not found' USING ERRCODE = '42501'; END IF;
  IF _c.status <> 'scheduled' THEN RAISE EXCEPTION 'contract not startable (%)', _c.status USING ERRCODE = '22023'; END IF;
  IF (now() AT TIME ZONE _c.timezone)::date <> _c.local_day THEN
    RAISE EXCEPTION 'contract is for another local day' USING ERRCODE = '22023'; END IF;
  IF _c.expires_at IS NOT NULL AND now() >= _c.expires_at THEN
    RAISE EXCEPTION 'recovery window closed' USING ERRCODE = '22023'; END IF;
  PERFORM pg_catalog.set_config('axen.contract_write', 'on', true);
  INSERT INTO public.contract_sessions(contract_id, user_id, started_at, expected_end_at, client_instance_id)
  VALUES (_c.id, _uid, now(), now() + pg_catalog.make_interval(secs => _c.planned_seconds), left(_client_instance, 64))
  RETURNING * INTO _s;
  UPDATE public.daily_contracts SET status = 'active', started_at = now(),
     comeback_started_at = CASE WHEN _c.is_recovery THEN now() END,
     comeback_ends_at = CASE WHEN _c.is_recovery THEN now() + interval '900 seconds' END
   WHERE id = _c.id;
  PERFORM public.log_contract_event(_c.id, _uid, 'started', 'scheduled', 'active', pg_catalog.jsonb_build_object('session_id', _s.id));
  RETURN _s;
END; $function$;

-- End: a due comeback finalizes instead of going to proof.
CREATE OR REPLACE FUNCTION public.end_contract_session(_session_id uuid, _reason text)
 RETURNS contract_sessions LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
DECLARE _uid uuid := auth.uid(); _s public.contract_sessions; _c public.daily_contracts; _elapsed integer; _ok boolean;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501'; END IF;
  IF _reason NOT IN ('completed','stuck','emergency','user_ended') THEN RAISE EXCEPTION 'invalid reason' USING ERRCODE = '22023'; END IF;
  SELECT * INTO _s FROM public.contract_sessions WHERE id = _session_id AND user_id = _uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'session not found' USING ERRCODE = '42501'; END IF;
  IF _s.session_status <> 'active' THEN RETURN _s; END IF;
  SELECT * INTO _c FROM public.daily_contracts WHERE id = _s.contract_id FOR UPDATE;
  IF _c.is_recovery AND _c.comeback_ends_at IS NOT NULL AND _c.comeback_ends_at <= now() THEN
    PERFORM public.axen_finalize_comeback(_c.id);
    SELECT * INTO _s FROM public.contract_sessions WHERE id = _session_id;
    RETURN _s;
  END IF;
  _elapsed := LEAST(EXTRACT(EPOCH FROM (now() - _s.started_at))::integer, _c.planned_seconds + 3600);
  _ok := _elapsed >= (CASE WHEN _c.is_recovery THEN _c.planned_seconds ELSE _c.rescue_seconds END);
  IF _c.expires_at IS NOT NULL AND now() > _c.expires_at THEN _ok := false; END IF;
  PERFORM pg_catalog.set_config('axen.contract_write', 'on', true);
  UPDATE public.contract_sessions SET ended_at = now(), elapsed_seconds = _elapsed, exit_reason = _reason,
         session_status = CASE WHEN _ok THEN 'completed'::public.contract_session_status ELSE 'abandoned'::public.contract_session_status END
   WHERE id = _s.id RETURNING * INTO _s;
  IF _ok AND _c.status = 'active' THEN
    UPDATE public.daily_contracts SET status = 'proof_pending' WHERE id = _c.id;
    PERFORM public.log_contract_event(_c.id, _uid, 'ended', 'active', 'proof_pending', pg_catalog.jsonb_build_object('session_id', _s.id, 'elapsed', _elapsed, 'reason', _reason));
  ELSIF _c.status = 'active' THEN
    UPDATE public.daily_contracts SET status = 'missed' WHERE id = _c.id;
    PERFORM public.log_contract_event(_c.id, _uid, 'missed', 'active', 'missed', pg_catalog.jsonb_build_object('session_id', _s.id, 'elapsed', _elapsed, 'reason', _reason));
  END IF;
  RETURN _s;
END; $function$;