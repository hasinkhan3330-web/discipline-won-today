DROP FUNCTION IF EXISTS public.get_accountability_details();
DROP FUNCTION IF EXISTS public.send_accountability_nudge(uuid, text, text);

CREATE FUNCTION public.send_accountability_nudge(
  _connection_id uuid,
  _kind text,
  _message text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
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

  IF _kind = 'nudge' AND (_message IS NULL OR _message NOT IN (
    'Bhai uth, aaj ka task pending hai 🔥',
    'Tera streak toot raha hai — 1 task kar abhi ⚡',
    'Discipline seeker ya excuse maker? Choice teri 💀',
    'Top 10 mein aana hai? Aaj ka kaam kar 🏆',
    'Main dekh raha hoon — mat chook aaj 🤝'
  )) THEN RAISE EXCEPTION 'invalid nudge' USING ERRCODE = '22023'; END IF;
  IF _kind IN ('emergency', 'checkin') AND _message IS NOT NULL THEN
    RAISE EXCEPTION 'message is server generated' USING ERRCODE = '22023';
  END IF;
  IF _muted THEN RAISE EXCEPTION 'partner has muted nudges' USING ERRCODE = '42501'; END IF;

  IF _kind = 'checkin' THEN
    IF NOT (EXISTS (SELECT 1 FROM public.task_completions tc WHERE tc.user_id = _uid AND tc.completed_on = current_date)
      OR EXISTS (SELECT 1 FROM public.daily_top_tasks top_task WHERE top_task.user_id = _uid AND top_task.day = current_date AND top_task.done)) THEN
      RAISE EXCEPTION 'complete a task first' USING ERRCODE = '42501';
    END IF;
    IF EXISTS (SELECT 1 FROM public.accountability_events ev WHERE ev.connection_id = _c.id
      AND ev.actor_id = _uid AND ev.kind = 'checkin'
      AND ev.created_at >= current_date::timestamptz AND ev.created_at < (current_date + 1)::timestamptz) THEN
      RAISE EXCEPTION 'already checked in today' USING ERRCODE = '23505';
    END IF;
    SELECT coalesce(nullif(btrim(p.username), ''), nullif(btrim(p.display_name), ''), 'Partner') INTO _sender_name
    FROM public.profiles p WHERE p.id = _uid;
    _stored_message := coalesce(_sender_name, 'Partner') || ' ne aaj apna task complete kiya';
    _event_kind := 'checkin';
  ELSE
    SELECT d.id INTO _contract FROM public.daily_contracts d
    WHERE d.user_id = _to AND d.is_recovery = false AND d.status <> 'cancelled'
      AND d.local_day = (now() AT TIME ZONE d.timezone)::date LIMIT 1;
    IF _contract IS NOT NULL AND (SELECT count(*) FROM public.accountability_events
      WHERE actor_id = _uid AND contract_id = _contract AND kind IN ('nudge', 'emergency')) >= 3 THEN
      RAISE EXCEPTION 'nudge limit for this contract' USING ERRCODE = '54000';
    END IF;
    IF (SELECT count(*) FROM public.accountability_events WHERE actor_id = _uid AND recipient_id = _to
      AND kind IN ('nudge', 'emergency', 'cheer') AND created_at > now() - interval '24 hours') >= 10 THEN
      RAISE EXCEPTION 'daily nudge limit' USING ERRCODE = '54000';
    END IF;
    _stored_message := CASE WHEN _kind = 'emergency' THEN '🚨 Emergency Nudge' ELSE _message END;
    _event_kind := _kind;
  END IF;

  PERFORM pg_catalog.set_config('axen.contract_write', 'on', true);
  INSERT INTO public.accountability_events(connection_id, actor_id, recipient_id, kind, message, contract_id)
  VALUES (_c.id, _uid, _to, _event_kind, _stored_message, _contract);
  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.send_accountability_nudge(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_accountability_nudge(uuid, text, text) TO authenticated;