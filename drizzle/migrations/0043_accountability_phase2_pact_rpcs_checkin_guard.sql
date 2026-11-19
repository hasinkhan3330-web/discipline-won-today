CREATE OR REPLACE FUNCTION public.acct_checkin_day_guard()
 RETURNS trigger LANGUAGE plpgsql SET search_path = public
AS $$
DECLARE _today date;
BEGIN
  _today := (now() AT TIME ZONE coalesce(
    (SELECT p.reward_timezone FROM public.profiles p WHERE p.id = NEW.user_id
       AND EXISTS (SELECT 1 FROM pg_catalog.pg_timezone_names z WHERE z.name = p.reward_timezone)),
    'UTC'))::date;
  IF NEW.day IS NULL OR NEW.day < _today - 1 OR NEW.day > _today + 1 THEN
    RAISE EXCEPTION 'Check-in day is not valid' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER acct_checkin_day_guard_trg
  BEFORE INSERT OR UPDATE OF day ON public.acct_checkins
  FOR EACH ROW EXECUTE FUNCTION public.acct_checkin_day_guard();

CREATE OR REPLACE FUNCTION public.save_pact(_id uuid, _payload jsonb)
 RETURNS public.daily_contracts LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _allowed text[] := ARRAY['goal_id','title','category','scheduled_at','timezone','planned_seconds','rescue_seconds',
    'trigger_text','proof_method','difficulty','reminder_pref','private_note','accountability_enabled','status',
    'deadline_at','done_criteria','fallback_action','minimum_version','obstacles','evidence_required','is_solo','partner_visibility'];
  _bad text; _r public.daily_contracts; _old public.daily_contracts; _st text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501'; END IF;
  IF _id IS NULL OR _payload IS NULL OR jsonb_typeof(_payload) <> 'object' THEN RAISE EXCEPTION 'invalid pact' USING ERRCODE = '22023'; END IF;
  SELECT k INTO _bad FROM jsonb_object_keys(_payload) k WHERE k <> ALL(_allowed) LIMIT 1;
  IF _bad IS NOT NULL THEN RAISE EXCEPTION 'unknown field %', _bad USING ERRCODE = '22023'; END IF;
  _st := coalesce(_payload->>'status', 'scheduled');
  IF _st NOT IN ('draft','scheduled') THEN RAISE EXCEPTION 'invalid status' USING ERRCODE = '42501'; END IF;
  _r := jsonb_populate_record(NULL::public.daily_contracts, _payload);

  SELECT * INTO _old FROM public.daily_contracts WHERE id = _id FOR UPDATE;
  IF FOUND THEN
    IF _old.user_id <> _uid THEN RAISE EXCEPTION 'not owner' USING ERRCODE = '42501'; END IF;
    IF _old.status NOT IN ('draft','scheduled') THEN RAISE EXCEPTION 'not owner' USING ERRCODE = '42501'; END IF;
    UPDATE public.daily_contracts SET
      goal_id = CASE WHEN _payload ? 'goal_id' THEN _r.goal_id ELSE goal_id END,
      title = CASE WHEN _payload ? 'title' THEN _r.title ELSE title END,
      category = CASE WHEN _payload ? 'category' THEN _r.category ELSE category END,
      scheduled_at = CASE WHEN _payload ? 'scheduled_at' THEN _r.scheduled_at ELSE scheduled_at END,
      timezone = CASE WHEN _payload ? 'timezone' THEN _r.timezone ELSE timezone END,
      planned_seconds = CASE WHEN _payload ? 'planned_seconds' THEN _r.planned_seconds ELSE planned_seconds END,
      rescue_seconds = CASE WHEN _payload ? 'rescue_seconds' THEN _r.rescue_seconds ELSE rescue_seconds END,
      trigger_text = CASE WHEN _payload ? 'trigger_text' THEN _r.trigger_text ELSE trigger_text END,
      proof_method = CASE WHEN _payload ? 'proof_method' THEN _r.proof_method ELSE proof_method END,
      difficulty = CASE WHEN _payload ? 'difficulty' THEN _r.difficulty ELSE difficulty END,
      reminder_pref = CASE WHEN _payload ? 'reminder_pref' THEN _r.reminder_pref ELSE reminder_pref END,
      private_note = CASE WHEN _payload ? 'private_note' THEN _r.private_note ELSE private_note END,
      accountability_enabled = CASE WHEN _payload ? 'accountability_enabled' THEN _r.accountability_enabled ELSE accountability_enabled END,
      status = _st::public.contract_status,
      deadline_at = CASE WHEN _payload ? 'deadline_at' THEN _r.deadline_at ELSE deadline_at END,
      done_criteria = CASE WHEN _payload ? 'done_criteria' THEN _r.done_criteria ELSE done_criteria END,
      fallback_action = CASE WHEN _payload ? 'fallback_action' THEN _r.fallback_action ELSE fallback_action END,
      minimum_version = CASE WHEN _payload ? 'minimum_version' THEN _r.minimum_version ELSE minimum_version END,
      obstacles = CASE WHEN _payload ? 'obstacles' THEN _r.obstacles ELSE obstacles END,
      evidence_required = CASE WHEN _payload ? 'evidence_required' THEN _r.evidence_required ELSE evidence_required END,
      is_solo = CASE WHEN _payload ? 'is_solo' THEN _r.is_solo ELSE is_solo END,
      partner_visibility = CASE WHEN _payload ? 'partner_visibility' THEN _r.partner_visibility ELSE partner_visibility END
    WHERE id = _id RETURNING * INTO _r;
    RETURN _r;
  END IF;

  _r.id := _id; _r.user_id := _uid; _r.status := _st::public.contract_status;
  _r.local_day := coalesce(_r.local_day, (_r.scheduled_at AT TIME ZONE coalesce(_r.timezone,'UTC'))::date);
  INSERT INTO public.daily_contracts SELECT (jsonb_populate_record(NULL::public.daily_contracts,
      jsonb_strip_nulls(to_jsonb(_r)) )).*
  ON CONFLICT (id) DO NOTHING;
  SELECT * INTO _r FROM public.daily_contracts WHERE id = _id AND user_id = _uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'not owner' USING ERRCODE = '42501'; END IF;
  RETURN _r;
END $$;

CREATE OR REPLACE FUNCTION public.set_pact_pause(_id uuid, _paused boolean)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _uid uuid := auth.uid(); _c public.daily_contracts;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501'; END IF;
  SELECT * INTO _c FROM public.daily_contracts WHERE id = _id AND user_id = _uid FOR UPDATE;
  IF NOT FOUND OR _c.status NOT IN ('draft','scheduled') THEN RETURN NULL; END IF;
  UPDATE public.daily_contracts SET paused_at = CASE WHEN _paused THEN now() ELSE NULL END WHERE id = _id;
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.cancel_pact(_id uuid)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _uid uuid := auth.uid(); _c public.daily_contracts;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501'; END IF;
  SELECT * INTO _c FROM public.daily_contracts WHERE id = _id AND user_id = _uid FOR UPDATE;
  IF NOT FOUND OR _c.status NOT IN ('draft','scheduled') THEN RETURN NULL; END IF;
  UPDATE public.daily_contracts SET status = 'cancelled' WHERE id = _id;
  RETURN _id;
END $$;

REVOKE ALL ON FUNCTION public.save_pact(uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_pact_pause(uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancel_pact(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.acct_checkin_day_guard() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_pact(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_pact_pause(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_pact(uuid) TO authenticated;