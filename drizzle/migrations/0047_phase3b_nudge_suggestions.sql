ALTER TABLE public.nudge_templates ADD COLUMN IF NOT EXISTS state_tag text NOT NULL DEFAULT 'generic';
ALTER TABLE public.nudge_templates ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'hinglish';

CREATE TABLE public.nudge_suggestion_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sender uuid NOT NULL,
  receiver uuid NOT NULL,
  template_id text NOT NULL,
  local_day date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sender, receiver, template_id, local_day)
);
REVOKE ALL ON public.nudge_suggestion_log FROM anon, authenticated;
GRANT ALL ON public.nudge_suggestion_log TO service_role;
ALTER TABLE public.nudge_suggestion_log ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.nudge_receiver_state(_receiver uuid, _day date)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM daily_contracts c WHERE c.user_id=_receiver AND c.local_day=_day AND c.status='scheduled' AND c.deadline_at < now()) THEN 'overdue'
    WHEN EXISTS (SELECT 1 FROM daily_contracts c WHERE c.user_id=_receiver AND c.local_day=_day AND c.status='scheduled' AND c.scheduled_at > now() AND c.scheduled_at <= now() + interval '2 hours') THEN 'due_soon'
    WHEN EXISTS (SELECT 1 FROM daily_contracts c WHERE c.user_id=_receiver AND c.local_day=_day AND c.status='scheduled' AND c.scheduled_at <= now() AND c.started_at IS NULL) THEN 'not_started'
    WHEN EXISTS (SELECT 1 FROM daily_contracts c WHERE c.user_id=_receiver AND c.local_day=_day AND c.status='active' AND c.started_at < now() - make_interval(secs => c.planned_seconds)) THEN 'stuck'
    WHEN EXISTS (SELECT 1 FROM profiles p WHERE p.id=_receiver AND coalesce(p.streak,0) > 0 AND (p.last_activity_date IS NULL OR p.last_activity_date < _day)) THEN 'streak_at_risk'
    WHEN EXISTS (SELECT 1 FROM daily_contracts c WHERE c.user_id=_receiver AND c.local_day BETWEEN _day - 1 AND _day AND c.status='missed' AND c.is_recovery = false
                 AND NOT EXISTS (SELECT 1 FROM daily_contracts r WHERE r.recovery_of_id = c.id)) THEN 'comeback'
    WHEN EXISTS (SELECT 1 FROM daily_contracts c WHERE c.user_id=_receiver AND c.local_day=_day AND c.status IN ('verified','rewarded','proof_pending')) THEN 'pact_completed'
    WHEN EXISTS (SELECT 1 FROM daily_contracts c WHERE c.user_id=_receiver AND c.local_day=_day AND c.status='active') THEN 'partner_working'
    ELSE 'generic' END
$$;
REVOKE ALL ON FUNCTION public.nudge_receiver_state(uuid, date) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_nudge_suggestions()
RETURNS TABLE(template_id text, category text, text text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _c accountability_connections;
  _to uuid; _muted boolean; _share boolean;
  _day date; _state text;
  _since timestamptz; _start timestamptz;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501'; END IF;
  SELECT * INTO _c FROM accountability_connections a
  WHERE a.status = 'active' AND (a.user_id = _uid OR a.partner_id = _uid)
  ORDER BY a.created_at DESC LIMIT 1;
  IF NOT FOUND THEN RETURN; END IF;
  IF _c.user_id = _uid THEN _to := _c.partner_id; _muted := _c.muted_by_partner; _share := _c.share_by_partner;
  ELSE _to := _c.user_id; _muted := _c.muted_by_user; _share := _c.share_by_user; END IF;
  IF _muted THEN RETURN; END IF;

  _day := acct_user_today(_to);
  _start := (_day::timestamp AT TIME ZONE coalesce((SELECT p.reward_timezone FROM profiles p WHERE p.id=_to), 'UTC'));
  _since := _start - interval '7 days';
  _state := CASE WHEN coalesce(_share, false) THEN nudge_receiver_state(_to, _day) ELSE 'generic' END;

  RETURN QUERY
  WITH pool AS (
    SELECT t.id, t.category, t.text, (t.state_tag = _state) AS primary_pool
    FROM nudge_templates t
    WHERE t.active AND t.category <> 'emergency' AND (t.state_tag = _state OR t.state_tag = 'generic')
  ), used AS (
    SELECT l.template_id AS id, max(l.created_at) AS last_at FROM nudge_suggestion_log l
    WHERE l.sender=_uid AND l.receiver=_to AND l.created_at >= _since AND l.created_at < _start GROUP BY 1
    UNION ALL
    SELECT e.template_id, max(e.created_at) FROM accountability_events e
    WHERE e.actor_id=_uid AND e.recipient_id=_to AND e.template_id IS NOT NULL AND e.created_at >= _since AND e.created_at < _start GROUP BY 1
  ), ranked AS (
    SELECT p.id, p.category, p.text, p.primary_pool, max(u.last_at) AS last_at
    FROM pool p LEFT JOIN used u ON u.id = p.id GROUP BY 1,2,3,4
  ), pick AS (
    SELECT r.id, r.category, r.text FROM ranked r
    ORDER BY r.primary_pool DESC, (r.last_at IS NULL) DESC, r.last_at ASC NULLS FIRST, md5(_to::text || _day::text || r.id)
    LIMIT 4
  ), logged AS (
    INSERT INTO nudge_suggestion_log(sender, receiver, template_id, local_day)
    SELECT _uid, _to, pk.id, _day FROM pick pk
    ON CONFLICT DO NOTHING RETURNING 1
  )
  SELECT pk.id, pk.category, pk.text FROM pick pk;
END $$;
REVOKE ALL ON FUNCTION public.get_nudge_suggestions() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_nudge_suggestions() TO authenticated, service_role;