CREATE OR REPLACE FUNCTION public.start_recovery(_original_id uuid, _reason text DEFAULT NULL::text)
 RETURNS daily_contracts
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _o   public.daily_contracts;
  _r   public.daily_contracts;
  _secs integer := 900;
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