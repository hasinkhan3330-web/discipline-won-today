CREATE OR REPLACE FUNCTION public.send_nudge(_template_id text, _pact_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  IF _t.category <> 'emergency' AND (SELECT count(*) FROM public.accountability_events WHERE actor_id = _uid AND recipient_id = _to
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
END $function$;