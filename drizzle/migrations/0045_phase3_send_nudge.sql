ALTER TABLE public.accountability_events ADD COLUMN IF NOT EXISTS template_id text, ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE public.partner_events ADD COLUMN IF NOT EXISTS template_id text, ADD COLUMN IF NOT EXISTS category text;
CREATE INDEX IF NOT EXISTS accountability_events_actor_recipient_time_idx ON public.accountability_events(actor_id, recipient_id, created_at DESC);

CREATE TABLE public.nudge_templates (
  id text PRIMARY KEY,
  category text NOT NULL CHECK (category IN ('gentle','push','hard','emergency')),
  text text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.nudge_templates TO authenticated;
GRANT ALL ON public.nudge_templates TO service_role;
ALTER TABLE public.nudge_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY nudge_templates_read_active ON public.nudge_templates FOR SELECT TO authenticated USING (active);

CREATE OR REPLACE FUNCTION public.partner_events_from_acct_event()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $f$
BEGIN
  IF NEW.kind IN ('nudge','emergency') AND NEW.connection_id IS NOT NULL AND NEW.recipient_id IS NOT NULL THEN
    BEGIN
      INSERT INTO public.partner_events(connection_id, from_user, to_user, kind, text, created_at, template_id, category)
      VALUES (NEW.connection_id, NEW.actor_id, NEW.recipient_id, NEW.kind, coalesce(NEW.message, ''), coalesce(NEW.created_at, now()), NEW.template_id, NEW.category);
    EXCEPTION WHEN others THEN
      RAISE WARNING 'partner_events insert failed (accountability_events %): %', NEW.id, SQLERRM;
    END;
  END IF;
  RETURN NULL;
END $f$;

CREATE OR REPLACE FUNCTION public.send_nudge(_template_id text, _pact_id uuid DEFAULT NULL)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $f$
DECLARE
  _uid uuid := auth.uid();
  _c public.accountability_connections;
  _to uuid; _muted boolean;
  _t public.nudge_templates;
  _kind text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501'; END IF;
  SELECT * INTO _t FROM public.nudge_templates WHERE id = _template_id AND active;
  IF NOT FOUND THEN RAISE EXCEPTION 'invalid nudge' USING ERRCODE = '22023'; END IF;

  SELECT * INTO _c FROM public.accountability_connections
  WHERE status = 'active' AND (user_id = _uid OR partner_id = _uid)
  ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'no active connection' USING ERRCODE = '42501'; END IF;
  IF _c.user_id = _uid THEN _to := _c.partner_id; _muted := _c.muted_by_partner;
  ELSE _to := _c.user_id; _muted := _c.muted_by_user; END IF;
  IF _muted THEN RAISE EXCEPTION 'partner has muted nudges' USING ERRCODE = '42501'; END IF;

  IF _pact_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.daily_contracts d WHERE d.id = _pact_id AND d.user_id = _to) THEN
    RAISE EXCEPTION 'invalid pact' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (SELECT 1 FROM public.accountability_events WHERE actor_id = _uid AND recipient_id = _to
      AND template_id = _t.id AND created_at > now() - interval '30 minutes') THEN
    RAISE EXCEPTION 'same nudge limit' USING ERRCODE = '54000'; END IF;
  IF (SELECT count(*) FROM public.accountability_events WHERE actor_id = _uid AND recipient_id = _to
      AND kind IN ('nudge','emergency') AND created_at > now() - interval '1 hour') >= 3 THEN
    RAISE EXCEPTION 'hourly nudge limit' USING ERRCODE = '54000'; END IF;
  IF (SELECT count(*) FROM public.accountability_events WHERE actor_id = _uid AND recipient_id = _to
      AND kind IN ('nudge','emergency') AND created_at > now() - interval '24 hours') >= 10 THEN
    RAISE EXCEPTION 'daily nudge limit' USING ERRCODE = '54000'; END IF;
  IF _t.category = 'hard' AND (SELECT count(*) FROM public.accountability_events WHERE actor_id = _uid AND recipient_id = _to
      AND category = 'hard' AND created_at > now() - interval '24 hours') >= 2 THEN
    RAISE EXCEPTION 'hard nudge limit' USING ERRCODE = '54000'; END IF;
  IF _t.category = 'emergency' AND EXISTS (SELECT 1 FROM public.accountability_events WHERE actor_id = _uid AND recipient_id = _to
      AND kind = 'emergency' AND created_at > now() - interval '24 hours') THEN
    RAISE EXCEPTION 'emergency limit' USING ERRCODE = '54000'; END IF;

  _kind := CASE WHEN _t.category = 'emergency' THEN 'emergency' ELSE 'nudge' END;
  PERFORM pg_catalog.set_config('axen.contract_write', 'on', true);
  INSERT INTO public.accountability_events(connection_id, actor_id, recipient_id, kind, message, contract_id, template_id, category)
  VALUES (_c.id, _uid, _to, _kind, _t.text, _pact_id, _t.id, _t.category);
  RETURN jsonb_build_object('ok', true);
END $f$;
REVOKE ALL ON FUNCTION public.send_nudge(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_nudge(text, uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS partner_events_select_parties ON public.partner_events;
CREATE POLICY partner_events_select_parties ON public.partner_events FOR SELECT TO authenticated
  USING (auth.uid() = from_user OR auth.uid() = to_user);
DROP POLICY IF EXISTS partner_events_recipient_mark_seen ON public.partner_events;
CREATE POLICY partner_events_recipient_mark_seen ON public.partner_events FOR UPDATE TO authenticated
  USING (to_user = auth.uid()) WITH CHECK (to_user = auth.uid());

CREATE OR REPLACE FUNCTION public.send_accountability_nudge(_connection_id uuid, _kind text, _message text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _c public.accountability_connections;
  _to uuid;
  _muted boolean;
  _contract uuid;
  _stored_message text;
  _event_kind text;
  _sender_name text;
  _clean_commitment text;
  _details jsonb;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501'; END IF;
  IF _kind NOT IN ('details', 'nudge', 'emergency', 'checkin', 'commitment') THEN
    RAISE EXCEPTION 'invalid nudge' USING ERRCODE = '22023';
  END IF;
  IF _kind IN ('nudge', 'emergency') THEN
    RAISE EXCEPTION 'use send_nudge' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO _c FROM public.accountability_connections
  WHERE id = _connection_id AND status = 'active'
    AND (user_id = _uid OR partner_id = _uid)
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'no active connection' USING ERRCODE = '42501'; END IF;

  IF _c.user_id = _uid THEN
    _to := _c.partner_id;
    _muted := _c.muted_by_partner;
  ELSE
    _to := _c.user_id;
    _muted := _c.muted_by_user;
  END IF;

  IF _kind = 'details' THEN
    IF _message IS NOT NULL THEN RAISE EXCEPTION 'invalid details request' USING ERRCODE = '22023'; END IF;
    SELECT jsonb_build_object(
      'my_commitment', CASE WHEN _c.user_id = _uid THEN _c.commitment_by_user ELSE _c.commitment_by_partner END,
      'partner_commitment', CASE WHEN _c.user_id = _uid THEN _c.commitment_by_partner ELSE _c.commitment_by_user END,
      'partner_streak', coalesce(p.streak, 0),
      'partner_weekly_coins', coalesce((SELECT sum(ct.amount)::bigint FROM public.coin_transactions ct
        WHERE ct.user_id = _to AND ct.amount > 0
          AND ct.created_at >= date_trunc('week', now())
          AND ct.created_at < date_trunc('week', now()) + interval '7 days'), 0),
      'partner_weekly_tasks', coalesce((SELECT count(*)::integer FROM public.task_completions tc
        WHERE tc.user_id = _to
          AND tc.completed_on >= date_trunc('week', current_date)::date
          AND tc.completed_on < (date_trunc('week', current_date) + interval '7 days')::date), 0),
      'can_check_in', (EXISTS (SELECT 1 FROM public.task_completions mine
        WHERE mine.user_id = _uid AND mine.completed_on = current_date)
        OR EXISTS (SELECT 1 FROM public.daily_top_tasks top_task
        WHERE top_task.user_id = _uid AND top_task.day = current_date AND top_task.done)),
      'checked_in_today', EXISTS (SELECT 1 FROM public.accountability_events ev
        WHERE ev.connection_id = _c.id AND ev.actor_id = _uid AND ev.kind = 'checkin'
          AND ev.created_at >= current_date::timestamptz
          AND ev.created_at < (current_date + 1)::timestamptz)
    ) INTO _details FROM public.profiles p WHERE p.id = _to;
    RETURN coalesce(_details, jsonb_build_object(
      'my_commitment', CASE WHEN _c.user_id = _uid THEN _c.commitment_by_user ELSE _c.commitment_by_partner END,
      'partner_commitment', CASE WHEN _c.user_id = _uid THEN _c.commitment_by_partner ELSE _c.commitment_by_user END,
      'partner_streak', 0, 'partner_weekly_coins', 0, 'partner_weekly_tasks', 0,
      'can_check_in', false, 'checked_in_today', false
    ));
  END IF;

  IF _kind = 'commitment' THEN
    IF char_length(btrim(coalesce(_message, ''))) > 100 THEN
      RAISE EXCEPTION 'commitment too long' USING ERRCODE = '22023';
    END IF;
    _clean_commitment := nullif(btrim(coalesce(_message, '')), '');
    PERFORM pg_catalog.set_config('axen.contract_write', 'on', true);
    IF _c.user_id = _uid THEN
      UPDATE public.accountability_connections SET commitment_by_user = _clean_commitment WHERE id = _c.id;
    ELSE
      UPDATE public.accountability_connections SET commitment_by_partner = _clean_commitment WHERE id = _c.id;
    END IF;
    RETURN jsonb_build_object('ok', true);
  END IF;

  IF _kind IN ('emergency', 'checkin') AND _message IS NOT NULL THEN
    RAISE EXCEPTION 'message is server generated' USING ERRCODE = '22023';
  END IF;
  IF _muted THEN RAISE EXCEPTION 'partner has muted nudges' USING ERRCODE = '42501'; END IF;

  IF NOT (EXISTS (SELECT 1 FROM public.task_completions tc WHERE tc.user_id = _uid AND tc.completed_on = current_date)
    OR EXISTS (SELECT 1 FROM public.daily_top_tasks top_task WHERE top_task.user_id = _uid AND top_task.day = current_date AND top_task.done)) THEN
    RAISE EXCEPTION 'complete a task first' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (SELECT 1 FROM public.accountability_events ev WHERE ev.connection_id = _c.id
    AND ev.actor_id = _uid AND ev.kind = 'checkin'
    AND ev.created_at >= current_date::timestamptz AND ev.created_at < (current_date + 1)::timestamptz) THEN
    RAISE EXCEPTION 'already checked in today' USING ERRCODE = '23505';
  END IF;
  SELECT public.axen_public_display_name(p.display_name, p.id) INTO _sender_name
  FROM public.profiles p WHERE p.id = _uid;
  _stored_message := coalesce(_sender_name, 'Partner') || ' ne aaj apna task complete kiya';
  _event_kind := 'checkin';

  PERFORM pg_catalog.set_config('axen.contract_write', 'on', true);
  INSERT INTO public.accountability_events(connection_id, actor_id, recipient_id, kind, message, contract_id)
  VALUES (_c.id, _uid, _to, _event_kind, _stored_message, _contract);
  RETURN jsonb_build_object('ok', true);
END;
$function$;