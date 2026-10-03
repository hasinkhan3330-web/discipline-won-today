ALTER TABLE public.proof_submissions
  ADD COLUMN IF NOT EXISTS partner_review_status text,
  ADD COLUMN IF NOT EXISTS reviewer_id uuid,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS review_note text,
  ADD COLUMN IF NOT EXISTS asked_once boolean NOT NULL DEFAULT false;

ALTER TABLE public.proof_submissions DROP CONSTRAINT IF EXISTS proof_submissions_partner_review_check;
ALTER TABLE public.proof_submissions ADD CONSTRAINT proof_submissions_partner_review_check
  CHECK (partner_review_status IS NULL OR partner_review_status IN ('pending','confirmed','asked','disputed','self_reported'));
ALTER TABLE public.proof_submissions DROP CONSTRAINT IF EXISTS proof_submissions_review_note_check;
ALTER TABLE public.proof_submissions ADD CONSTRAINT proof_submissions_review_note_check
  CHECK (review_note IS NULL OR char_length(review_note) <= 280);
ALTER TABLE public.proof_submissions DROP CONSTRAINT IF EXISTS proof_submissions_no_self_review;
ALTER TABLE public.proof_submissions ADD CONSTRAINT proof_submissions_no_self_review
  CHECK (reviewer_id IS NULL OR reviewer_id <> user_id);

ALTER TABLE public.accountability_events DROP CONSTRAINT IF EXISTS accountability_events_kind_check;
ALTER TABLE public.accountability_events ADD CONSTRAINT accountability_events_kind_check
  CHECK (kind = ANY (ARRAY['nudge','cheer','contract_verified','contract_missed','connected','revoked',
    'emergency','checkin','review_requested','review_confirmed','review_asked','review_disputed','review_resubmitted','review_resolved']));

COMMENT ON COLUMN public.accountability_pacts.stake_coins IS 'DEPRECATED: AXEN accountability is non-financial; no stakes are read or applied.';

-- Client inserts can never pre-set review fields; pending only when an active partner exists.
CREATE OR REPLACE FUNCTION public.set_proof_partner_review()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  NEW.reviewer_id := NULL; NEW.reviewed_at := NULL; NEW.review_note := NULL; NEW.asked_once := false;
  IF EXISTS (SELECT 1 FROM public.accountability_connections a
             WHERE a.status = 'active' AND (a.user_id = NEW.user_id OR a.partner_id = NEW.user_id)) THEN
    NEW.partner_review_status := 'pending';
  ELSE
    NEW.partner_review_status := 'self_reported';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.set_proof_partner_review() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_set_proof_partner_review ON public.proof_submissions;
CREATE TRIGGER trg_set_proof_partner_review BEFORE INSERT ON public.proof_submissions
  FOR EACH ROW EXECUTE FUNCTION public.set_proof_partner_review();

-- One protected entry point for every review transition (partner + owner actions).
CREATE OR REPLACE FUNCTION public.partner_proof_action(_proof_id uuid, _action text, _note text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  _uid uuid := auth.uid();
  _p public.proof_submissions;
  _conn uuid;
  _new text; _kind text; _msg text; _to uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501'; END IF;
  IF _note IS NOT NULL AND char_length(_note) > 280 THEN RAISE EXCEPTION 'note too long' USING ERRCODE = '22023'; END IF;
  SELECT * INTO _p FROM public.proof_submissions WHERE id = _proof_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not found' USING ERRCODE = '42501'; END IF;

  IF _action IN ('verify','ask','cannot_verify') THEN
    IF _p.user_id = _uid THEN RAISE EXCEPTION 'cannot review own proof' USING ERRCODE = '42501'; END IF;
    SELECT a.id INTO _conn FROM public.accountability_connections a
     WHERE a.status = 'active'
       AND ((a.user_id = _uid AND a.partner_id = _p.user_id) OR (a.partner_id = _uid AND a.user_id = _p.user_id));
    IF _conn IS NULL THEN RAISE EXCEPTION 'not found' USING ERRCODE = '42501'; END IF;
    IF _p.partner_review_status IS DISTINCT FROM 'pending' THEN
      IF (_action = 'verify' AND _p.partner_review_status = 'confirmed')
         OR (_action = 'cannot_verify' AND _p.partner_review_status = 'disputed')
         OR (_action = 'ask' AND _p.partner_review_status = 'asked') THEN
        RETURN _p.partner_review_status; -- idempotent repeat
      END IF;
      RAISE EXCEPTION 'proof not awaiting review' USING ERRCODE = '22023';
    END IF;
    IF _action = 'ask' AND _p.asked_once THEN RAISE EXCEPTION 'already asked once' USING ERRCODE = '22023'; END IF;
    _new := CASE _action WHEN 'verify' THEN 'confirmed' WHEN 'ask' THEN 'asked' ELSE 'disputed' END;
    _kind := CASE _action WHEN 'verify' THEN 'review_confirmed' WHEN 'ask' THEN 'review_asked' ELSE 'review_disputed' END;
    _msg := CASE _action WHEN 'verify' THEN 'Your partner confirmed your proof.'
                         WHEN 'ask' THEN 'Your partner asked for a little more detail.'
                         ELSE 'Your partner couldn''t confirm this one. Let''s sort it out together.' END;
    _to := _p.user_id;
    PERFORM pg_catalog.set_config('axen.contract_write', 'on', true);
    UPDATE public.proof_submissions SET partner_review_status = _new, reviewer_id = _uid, reviewed_at = now(),
      review_note = left(_note, 280), asked_once = asked_once OR _action = 'ask'
     WHERE id = _p.id;

  ELSIF _action IN ('resubmit','resolve') THEN
    IF _p.user_id <> _uid THEN RAISE EXCEPTION 'not found' USING ERRCODE = '42501'; END IF;
    IF _action = 'resubmit' THEN
      IF _p.partner_review_status = 'pending' THEN RETURN 'pending'; END IF;
      IF _p.partner_review_status <> 'asked' THEN RAISE EXCEPTION 'proof not awaiting detail' USING ERRCODE = '22023'; END IF;
      IF _note IS NULL OR char_length(btrim(_note)) < 3 THEN RAISE EXCEPTION 'add a short note' USING ERRCODE = '22023'; END IF;
      _new := 'pending'; _kind := 'review_resubmitted'; _msg := 'Your partner added more detail to their proof.';
    ELSE
      IF _p.partner_review_status = 'self_reported' THEN RETURN 'self_reported'; END IF;
      IF _p.partner_review_status <> 'disputed' THEN RAISE EXCEPTION 'proof not disputed' USING ERRCODE = '22023'; END IF;
      _new := 'self_reported'; _kind := 'review_resolved'; _msg := 'Your partner marked a disputed proof as self-reported.';
    END IF;
    SELECT CASE WHEN a.user_id = _uid THEN a.partner_id ELSE a.user_id END, a.id INTO _to, _conn
      FROM public.accountability_connections a
     WHERE a.status = 'active' AND (a.user_id = _uid OR a.partner_id = _uid) LIMIT 1;
    PERFORM pg_catalog.set_config('axen.contract_write', 'on', true);
    UPDATE public.proof_submissions SET partner_review_status = _new,
      review_note = CASE WHEN _action = 'resubmit' THEN left(_note, 280) ELSE review_note END
     WHERE id = _p.id;
  ELSE
    RAISE EXCEPTION 'invalid action' USING ERRCODE = '22023';
  END IF;

  PERFORM public.log_contract_event(_p.contract_id, _uid, _kind, NULL, NULL,
    pg_catalog.jsonb_build_object('proof_id', _p.id, 'review_status', _new));
  IF _conn IS NOT NULL AND _to IS NOT NULL THEN
    INSERT INTO public.accountability_events(connection_id, actor_id, recipient_id, kind, message, contract_id)
    VALUES (_conn, _uid, _to, _kind, _msg, _p.contract_id);
  END IF;
  RETURN _new;
END $$;
REVOKE ALL ON FUNCTION public.partner_proof_action(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.partner_proof_action(uuid, text, text) TO authenticated;

-- Minimal partner-safe review list (no private notes, photos, coins or full rows).
CREATE OR REPLACE FUNCTION public.get_partner_reviews()
RETURNS TABLE(proof_id uuid, owner_name text, title text, proof_type text, evidence text, planned_minutes integer,
              elapsed_minutes integer, submitted_at timestamptz, review_status text, asked_once boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT ps.id, coalesce(p.display_name, p.username, 'Partner'), c.title, ps.proof_type,
         CASE WHEN ps.proof_type IN ('timer_recall','checklist') THEN left(ps.text_evidence, 600) END,
         c.planned_seconds / 60, coalesce(s.elapsed_seconds, 0) / 60, ps.created_at,
         ps.partner_review_status, ps.asked_once
  FROM public.accountability_connections a
  JOIN public.proof_submissions ps
    ON ps.user_id = CASE WHEN a.user_id = auth.uid() THEN a.partner_id ELSE a.user_id END
  JOIN public.daily_contracts c ON c.id = ps.contract_id
  LEFT JOIN public.contract_sessions s ON s.id = ps.session_id
  LEFT JOIN public.profiles p ON p.id = ps.user_id
  WHERE auth.uid() IS NOT NULL AND a.status = 'active'
    AND (a.user_id = auth.uid() OR a.partner_id = auth.uid())
    AND ps.created_at >= a.created_at
    AND ps.partner_review_status IN ('pending','asked','disputed','confirmed')
    AND ps.created_at > now() - interval '14 days'
  ORDER BY ps.created_at DESC LIMIT 20;
$$;
REVOKE ALL ON FUNCTION public.get_partner_reviews() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_partner_reviews() TO authenticated;

-- Caller-only trust summary from real server history (last 60 days).
CREATE OR REPLACE FUNCTION public.get_trust_summary()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  _uid uuid := auth.uid();
  _confirmed int; _disputed int; _self int; _recov int; _abandoned int; _ontime int; _reviewed int; _score int;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501'; END IF;
  SELECT count(*) FILTER (WHERE partner_review_status = 'confirmed'),
         count(*) FILTER (WHERE partner_review_status = 'disputed'),
         count(*) FILTER (WHERE partner_review_status = 'self_reported')
    INTO _confirmed, _disputed, _self
    FROM public.proof_submissions WHERE user_id = _uid AND created_at > now() - interval '60 days';
  SELECT count(*) INTO _recov FROM public.recovery_events WHERE user_id = _uid AND created_at > now() - interval '60 days';
  SELECT count(*) FILTER (WHERE session_status = 'abandoned'),
         count(*) FILTER (WHERE session_status = 'completed' AND c.scheduled_at IS NOT NULL
                            AND s.started_at <= c.scheduled_at + interval '15 minutes')
    INTO _abandoned, _ontime
    FROM public.contract_sessions s JOIN public.daily_contracts c ON c.id = s.contract_id
   WHERE s.user_id = _uid AND s.started_at > now() - interval '60 days';
  _reviewed := _confirmed + _disputed;
  IF _reviewed >= 5 THEN
    _score := greatest(0, least(100, round(100.0 * _confirmed / _reviewed)::int - least(_abandoned, 10) * 2 + least(_ontime, 5)));
  END IF;
  RETURN pg_catalog.jsonb_build_object('confirmed', _confirmed, 'disputed', _disputed, 'self_reported', _self,
    'recoveries', _recov, 'abandoned', _abandoned, 'on_time', _ontime, 'reviewed', _reviewed,
    'threshold', 5, 'score', _score);
END $$;
REVOKE ALL ON FUNCTION public.get_trust_summary() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_trust_summary() TO authenticated;