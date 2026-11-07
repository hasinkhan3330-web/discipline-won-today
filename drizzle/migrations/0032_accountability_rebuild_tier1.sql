ALTER TABLE public.daily_contracts
  ADD COLUMN IF NOT EXISTS is_solo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS partner_visibility text NOT NULL DEFAULT 'private',
  ADD COLUMN IF NOT EXISTS minimum_version text,
  ADD COLUMN IF NOT EXISTS obstacles text,
  ADD COLUMN IF NOT EXISTS evidence_required text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS paused_at timestamptz;
ALTER TABLE public.daily_contracts
  ADD CONSTRAINT dc_partner_visibility_chk CHECK (partner_visibility IN ('private','partner')),
  ADD CONSTRAINT dc_minimum_version_len CHECK (minimum_version IS NULL OR char_length(minimum_version) <= 140),
  ADD CONSTRAINT dc_obstacles_len CHECK (obstacles IS NULL OR char_length(obstacles) <= 280),
  ADD CONSTRAINT dc_evidence_required_chk CHECK (evidence_required IN ('none','checkin','photo','document','session'));

CREATE TABLE public.acct_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  day date NOT NULL,
  action text CHECK (action IS NULL OR char_length(action) <= 140),
  completed boolean NOT NULL DEFAULT false,
  needs_help boolean NOT NULL DEFAULT false,
  next_step text CHECK (next_step IS NULL OR char_length(next_step) <= 140),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, day)
);
GRANT SELECT, INSERT, UPDATE ON public.acct_checkins TO authenticated;
GRANT ALL ON public.acct_checkins TO service_role;
ALTER TABLE public.acct_checkins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own checkins read" ON public.acct_checkins FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own checkins insert" ON public.acct_checkins FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own checkins update" ON public.acct_checkins FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.acct_milestones_seen (
  user_id uuid NOT NULL DEFAULT auth.uid(),
  kind text NOT NULL CHECK (kind IN ('pair_streak')),
  milestone integer NOT NULL CHECK (milestone IN (3,7,14,30)),
  seen_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, kind, milestone)
);
GRANT SELECT, INSERT ON public.acct_milestones_seen TO authenticated;
GRANT ALL ON public.acct_milestones_seen TO service_role;
ALTER TABLE public.acct_milestones_seen ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own milestones read" ON public.acct_milestones_seen FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own milestones insert" ON public.acct_milestones_seen FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE TABLE public.acct_settings (
  user_id uuid PRIMARY KEY DEFAULT auth.uid(),
  show_tree boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.acct_settings TO authenticated;
GRANT ALL ON public.acct_settings TO service_role;
ALTER TABLE public.acct_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own settings read" ON public.acct_settings FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own settings insert" ON public.acct_settings FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own settings update" ON public.acct_settings FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.acct_cheers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES public.accountability_connections(id),
  sender_id uuid NOT NULL,
  recipient_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('fire','clap','muscle')),
  day date NOT NULL DEFAULT current_date,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sender_id, day, kind)
);
GRANT SELECT ON public.acct_cheers TO authenticated;
GRANT ALL ON public.acct_cheers TO service_role;
ALTER TABLE public.acct_cheers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cheer parties read" ON public.acct_cheers FOR SELECT TO authenticated USING (sender_id = auth.uid() OR recipient_id = auth.uid());

-- internal helpers
CREATE OR REPLACE FUNCTION public.acct_active_partner(_uid uuid)
RETURNS TABLE(connection_id uuid, partner_id uuid) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
  SELECT c.id, CASE WHEN c.user_id = _uid THEN c.partner_id ELSE c.user_id END
  FROM public.accountability_connections c
  WHERE c.status = 'active' AND (c.user_id = _uid OR c.partner_id = _uid)
  ORDER BY c.created_at DESC LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.acct_user_today(_uid uuid)
RETURNS date LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
  SELECT (now() AT TIME ZONE coalesce((SELECT p.reward_timezone FROM public.profiles p WHERE p.id = _uid), 'UTC'))::date;
$$;

CREATE OR REPLACE FUNCTION public.acct_garden_for(_uid uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
DECLARE _today date := public.acct_user_today(_uid); _due int; _credit numeric; _overdue int; _ck int; _score int; _stage int; _next int;
BEGIN
  WITH w AS (
    SELECT c.* FROM public.daily_contracts c
    WHERE c.user_id = _uid AND NOT c.is_recovery AND c.local_day BETWEEN _today - 6 AND _today
      AND c.status::text NOT IN ('draft','cancelled') AND c.paused_at IS NULL
  ), d AS (
    SELECT w.*,
      (SELECT least(
         (SELECT min(s.ended_at) FROM public.contract_sessions s WHERE s.contract_id = w.id AND s.session_status = 'completed'),
         (SELECT min(p.created_at) FROM public.proof_submissions p WHERE p.contract_id = w.id))) AS done_at,
      EXISTS (SELECT 1 FROM public.daily_contracts r WHERE r.recovery_of_id = w.id AND r.status::text = 'rewarded') AS recovered
    FROM w
    WHERE w.local_day < _today OR w.status::text IN ('verified','rewarded','missed') OR (w.deadline_at IS NOT NULL AND w.deadline_at < now())
  )
  SELECT count(*),
         coalesce(sum(CASE WHEN status::text IN ('verified','rewarded') AND (deadline_at IS NULL OR done_at <= deadline_at) THEN 1
                           WHEN status::text IN ('verified','rewarded') THEN 0.6
                           WHEN recovered THEN 0.6 ELSE 0 END), 0)
    INTO _due, _credit FROM d;
  SELECT count(*) INTO _overdue FROM public.daily_contracts c
   WHERE c.user_id = _uid AND c.paused_at IS NULL AND c.status::text IN ('scheduled','active','proof_pending')
     AND (c.local_day < _today OR (c.deadline_at IS NOT NULL AND c.deadline_at < now()));
  SELECT count(DISTINCT k.day) INTO _ck FROM public.acct_checkins k WHERE k.user_id = _uid AND k.day BETWEEN _today - 6 AND _today;
  _score := round(CASE WHEN _due > 0 THEN 85 * _credit / _due ELSE 0 END + 15.0 * _ck / 7)::int - 10 * _overdue;
  _score := greatest(0, least(100, _score));
  _stage := CASE WHEN _score >= 80 THEN 5 WHEN _score >= 60 THEN 4 WHEN _score >= 40 THEN 3 WHEN _score >= 20 THEN 2 ELSE 1 END;
  _next := CASE WHEN _stage = 5 THEN NULL ELSE _stage * 20 END;
  RETURN jsonb_build_object('score', _score, 'stage', _stage,
    'stage_name', (ARRAY['Seed','Sapling','Young','Lush','Ancient'])[_stage],
    'points_to_next', CASE WHEN _next IS NULL THEN 0 ELSE _next - _score END,
    'due', _due, 'credit', _credit, 'overdue', _overdue, 'checkin_days', _ck, 'resting', _overdue > 0);
END $$;

-- user-callable
CREATE OR REPLACE FUNCTION public.acct_garden_score()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501'; END IF;
  RETURN public.acct_garden_for(auth.uid());
END $$;

CREATE OR REPLACE FUNCTION public.acct_partner_garden_stage()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
DECLARE _p uuid; _g jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501'; END IF;
  SELECT partner_id INTO _p FROM public.acct_active_partner(auth.uid());
  IF _p IS NULL THEN RETURN NULL; END IF;
  IF NOT coalesce((SELECT s.show_tree FROM public.acct_settings s WHERE s.user_id = _p), true) THEN RETURN NULL; END IF;
  _g := public.acct_garden_for(_p);
  RETURN jsonb_build_object('stage', _g->'stage', 'stage_name', _g->'stage_name');
END $$;

CREATE OR REPLACE FUNCTION public.acct_partner_checkin_status()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
DECLARE _p uuid; _k public.acct_checkins;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501'; END IF;
  SELECT partner_id INTO _p FROM public.acct_active_partner(auth.uid());
  IF _p IS NULL THEN RETURN NULL; END IF;
  SELECT * INTO _k FROM public.acct_checkins WHERE user_id = _p AND day = public.acct_user_today(_p);
  RETURN jsonb_build_object('checked_in', FOUND, 'completed', coalesce(_k.completed, false));
END $$;

CREATE OR REPLACE FUNCTION public.acct_pair_streak()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
DECLARE _uid uuid := auth.uid(); _p uuid; _d date; _n int := 0; _m int;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501'; END IF;
  SELECT partner_id INTO _p FROM public.acct_active_partner(_uid);
  IF _p IS NULL THEN RETURN jsonb_build_object('has_partner', false, 'streak', 0, 'milestone', NULL); END IF;
  _d := public.acct_user_today(_uid);
  IF NOT (EXISTS (SELECT 1 FROM public.daily_contracts WHERE user_id = _uid AND local_day = _d AND status::text IN ('verified','rewarded'))
      AND EXISTS (SELECT 1 FROM public.daily_contracts WHERE user_id = _p AND local_day = _d AND status::text IN ('verified','rewarded'))) THEN
    _d := _d - 1;
  END IF;
  LOOP
    EXIT WHEN NOT (EXISTS (SELECT 1 FROM public.daily_contracts WHERE user_id = _uid AND local_day = _d AND status::text IN ('verified','rewarded'))
              AND EXISTS (SELECT 1 FROM public.daily_contracts WHERE user_id = _p AND local_day = _d AND status::text IN ('verified','rewarded')));
    _n := _n + 1; _d := _d - 1;
    EXIT WHEN _n >= 366;
  END LOOP;
  SELECT max(m) INTO _m FROM unnest(ARRAY[3,7,14,30]) m
   WHERE m <= _n AND NOT EXISTS (SELECT 1 FROM public.acct_milestones_seen s WHERE s.user_id = _uid AND s.kind = 'pair_streak' AND s.milestone = m);
  RETURN jsonb_build_object('has_partner', true, 'streak', _n, 'milestone', _m);
END $$;

CREATE OR REPLACE FUNCTION public.acct_weekly_report()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
DECLARE _uid uuid := auth.uid(); _t date; _r jsonb;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501'; END IF;
  _t := public.acct_user_today(_uid);
  WITH c AS (
    SELECT * FROM public.daily_contracts WHERE user_id = _uid AND local_day BETWEEN _t - 6 AND _t AND status::text NOT IN ('draft','cancelled')
  ), days AS (
    SELECT g::date AS day,
      (SELECT count(*) FROM c WHERE c.local_day = g::date AND NOT c.is_recovery) AS total,
      (SELECT count(*) FROM c WHERE c.local_day = g::date AND c.status::text IN ('verified','rewarded')) AS done
    FROM generate_series(_t - 6, _t, interval '1 day') g
  )
  SELECT jsonb_build_object(
    'total', (SELECT count(*) FROM c WHERE NOT is_recovery),
    'completed', (SELECT count(*) FROM c WHERE NOT is_recovery AND status::text IN ('verified','rewarded')),
    'missed', (SELECT count(*) FROM c WHERE NOT is_recovery AND status::text = 'missed'),
    'recovered', (SELECT count(*) FROM c WHERE is_recovery AND status::text = 'rewarded'),
    'pending_reviews', (SELECT count(*) FROM public.proof_submissions p WHERE p.user_id = _uid AND p.partner_review_status = 'pending'),
    'avg_review_minutes', (SELECT round(avg(extract(epoch FROM (p.reviewed_at - p.created_at)) / 60))::int FROM public.proof_submissions p
                            WHERE p.user_id = _uid AND p.reviewed_at IS NOT NULL AND p.created_at >= now() - interval '7 days'),
    'focus_minutes', coalesce((SELECT sum(s.elapsed_seconds) / 60 FROM public.contract_sessions s
                               WHERE s.user_id = _uid AND s.session_status = 'completed' AND s.started_at >= now() - interval '7 days'), 0)::int
                    + coalesce((SELECT sum(f.minutes) FROM public.focus_sessions f WHERE f.user_id = _uid AND f.created_at >= now() - interval '7 days'), 0)::int,
    'days', (SELECT jsonb_agg(jsonb_build_object('day', day, 'total', total, 'done', done) ORDER BY day) FROM days),
    'best_day', (SELECT day FROM days WHERE done > 0 ORDER BY done DESC, day DESC LIMIT 1)
  ) INTO _r;
  RETURN _r;
END $$;

CREATE OR REPLACE FUNCTION public.acct_send_cheer(_kind text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE _uid uuid := auth.uid(); _c uuid; _p uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501'; END IF;
  IF _kind NOT IN ('fire','clap','muscle') THEN RAISE EXCEPTION 'invalid cheer' USING ERRCODE = '22023'; END IF;
  SELECT connection_id, partner_id INTO _c, _p FROM public.acct_active_partner(_uid);
  IF _p IS NULL THEN RAISE EXCEPTION 'No active partner' USING ERRCODE = '42501'; END IF;
  INSERT INTO public.acct_cheers(connection_id, sender_id, recipient_id, kind, day)
  VALUES (_c, _uid, _p, _kind, public.acct_user_today(_uid)) ON CONFLICT DO NOTHING;
  RETURN FOUND;
END $$;

REVOKE ALL ON FUNCTION public.acct_active_partner(uuid), public.acct_user_today(uuid), public.acct_garden_for(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.acct_garden_score(), public.acct_partner_garden_stage(), public.acct_partner_checkin_status(),
  public.acct_pair_streak(), public.acct_weekly_report(), public.acct_send_cheer(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.acct_garden_score(), public.acct_partner_garden_stage(), public.acct_partner_checkin_status(),
  public.acct_pair_streak(), public.acct_weekly_report(), public.acct_send_cheer(text) TO authenticated;