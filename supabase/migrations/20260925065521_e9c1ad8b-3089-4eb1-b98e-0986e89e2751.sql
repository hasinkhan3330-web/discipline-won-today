CREATE OR REPLACE FUNCTION public.start_recovery(_original_id uuid, _reason text DEFAULT NULL::text)
 RETURNS public.daily_contracts
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _o   public.daily_contracts;
  _r   public.daily_contracts;
  _secs integer;
  _why  text := NULLIF(btrim(_reason), '');
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501'; END IF;
  IF _why IS NOT NULL AND _why NOT IN
     ('time_conflict','task_too_large','low_energy','forgot','distraction','other') THEN
    RAISE EXCEPTION 'invalid reason' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO _o FROM public.daily_contracts
   WHERE id = _original_id AND user_id = _uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'contract not found' USING ERRCODE = '42501'; END IF;
  IF _o.is_recovery THEN RAISE EXCEPTION 'cannot recover a recovery' USING ERRCODE = '22023'; END IF;

  IF EXISTS (SELECT 1 FROM public.recovery_events WHERE original_contract_id = _o.id)
     OR EXISTS (SELECT 1 FROM public.daily_contracts WHERE recovery_of_id = _o.id) THEN
    RAISE EXCEPTION 'already_exists' USING ERRCODE = '23505';
  END IF;

  IF _o.status <> 'missed' THEN
    RAISE EXCEPTION 'only missed contracts can be recovered' USING ERRCODE = '22023';
  END IF;
  IF (now() AT TIME ZONE _o.timezone)::date <> _o.local_day THEN
    RAISE EXCEPTION 'recovery window closed' USING ERRCODE = '22023';
  END IF;

  _secs := LEAST(_o.planned_seconds,
                 GREATEST(300, (round(_o.planned_seconds * 0.2 / 60.0) * 60)::integer));

  PERFORM pg_catalog.set_config('axen.contract_write', 'on', true);
  BEGIN
    INSERT INTO public.daily_contracts(user_id, goal_id, title, category, scheduled_at, timezone, local_day,
        planned_seconds, rescue_seconds, trigger_text, proof_method, difficulty, status,
        is_recovery, recovery_of_id, expires_at)
    VALUES (_uid, _o.goal_id, _o.title, _o.category, now(), _o.timezone, _o.local_day,
        _secs, LEAST(_secs - 60, 240), _o.trigger_text, _o.proof_method, _o.difficulty, 'scheduled',
        true, _o.id, ((_o.local_day + 1)::timestamp AT TIME ZONE _o.timezone))
    RETURNING * INTO _r;

    INSERT INTO public.recovery_events(user_id, original_contract_id, recovery_contract_id, reason)
    VALUES (_uid, _o.id, _r.id, _why);
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'already_exists' USING ERRCODE = '23505';
  END;

  PERFORM public.log_contract_event(_o.id, _uid, 'recovery_started', 'missed', 'missed',
    pg_catalog.jsonb_build_object('recovery_id', _r.id, 'reason', _why));
  RETURN _r;
END;
$function$;

CREATE OR REPLACE FUNCTION public.start_contract_session(_contract_id uuid, _client_instance text DEFAULT NULL::text)
 RETURNS public.contract_sessions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _c   public.daily_contracts;
  _s   public.contract_sessions;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501'; END IF;
  SELECT * INTO _c FROM public.daily_contracts WHERE id = _contract_id AND user_id = _uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'contract not found' USING ERRCODE = '42501'; END IF;
  IF _c.status <> 'scheduled' THEN RAISE EXCEPTION 'contract not startable (%)', _c.status USING ERRCODE = '22023'; END IF;
  IF (now() AT TIME ZONE _c.timezone)::date <> _c.local_day THEN
    RAISE EXCEPTION 'contract is for another local day' USING ERRCODE = '22023';
  END IF;
  IF _c.expires_at IS NOT NULL AND now() >= _c.expires_at THEN
    RAISE EXCEPTION 'recovery window closed' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_catalog.set_config('axen.contract_write', 'on', true);
  INSERT INTO public.contract_sessions(contract_id, user_id, started_at, expected_end_at, client_instance_id)
  VALUES (_c.id, _uid, now(), now() + pg_catalog.make_interval(secs => _c.planned_seconds), left(_client_instance, 64))
  RETURNING * INTO _s;

  UPDATE public.daily_contracts SET status = 'active', started_at = now() WHERE id = _c.id;
  PERFORM public.log_contract_event(_c.id, _uid, 'started', 'scheduled', 'active',
                                    pg_catalog.jsonb_build_object('session_id', _s.id));
  RETURN _s;
END;
$function$;

CREATE OR REPLACE FUNCTION public.end_contract_session(_session_id uuid, _reason text)
 RETURNS public.contract_sessions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _s   public.contract_sessions;
  _c   public.daily_contracts;
  _elapsed integer;
  _ok boolean;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501'; END IF;
  IF _reason NOT IN ('completed','stuck','emergency','user_ended') THEN
    RAISE EXCEPTION 'invalid reason' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO _s FROM public.contract_sessions WHERE id = _session_id AND user_id = _uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'session not found' USING ERRCODE = '42501'; END IF;
  IF _s.session_status <> 'active' THEN RETURN _s; END IF;
  SELECT * INTO _c FROM public.daily_contracts WHERE id = _s.contract_id FOR UPDATE;

  _elapsed := LEAST(EXTRACT(EPOCH FROM (now() - _s.started_at))::integer, _c.planned_seconds + 3600);
  _ok := _elapsed >= (CASE WHEN _c.is_recovery THEN _c.planned_seconds ELSE _c.rescue_seconds END);
  IF _c.expires_at IS NOT NULL AND now() > _c.expires_at THEN _ok := false; END IF;

  PERFORM pg_catalog.set_config('axen.contract_write', 'on', true);
  UPDATE public.contract_sessions
     SET ended_at = now(), elapsed_seconds = _elapsed, exit_reason = _reason,
         session_status = CASE WHEN _ok THEN 'completed'::public.contract_session_status
                               ELSE 'abandoned'::public.contract_session_status END
   WHERE id = _s.id RETURNING * INTO _s;

  IF _ok AND _c.status = 'active' THEN
    UPDATE public.daily_contracts SET status = 'proof_pending' WHERE id = _c.id;
    PERFORM public.log_contract_event(_c.id, _uid, 'ended', 'active', 'proof_pending',
      pg_catalog.jsonb_build_object('session_id', _s.id, 'elapsed', _elapsed, 'reason', _reason));
  ELSIF _c.status = 'active' THEN
    UPDATE public.daily_contracts SET status = 'missed' WHERE id = _c.id;
    PERFORM public.log_contract_event(_c.id, _uid, 'missed', 'active', 'missed',
      pg_catalog.jsonb_build_object('session_id', _s.id, 'elapsed', _elapsed, 'reason', _reason));
  END IF;
  RETURN _s;
END;
$function$;

REVOKE ALL ON FUNCTION public.start_recovery(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.start_contract_session(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.end_contract_session(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_recovery(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_contract_session(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.end_contract_session(uuid, text) TO authenticated;