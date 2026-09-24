DO $$
BEGIN
  IF to_regclass('public.profiles') IS NULL OR to_regclass('public.goals') IS NULL
     OR to_regclass('public.score_events') IS NULL OR to_regclass('public.coin_transactions') IS NULL THEN
    RAISE EXCEPTION 'AXEN PHASE 1: baseline tables missing';
  END IF;
END $$;

DO $t$ BEGIN IF to_regtype('public.contract_status') IS NULL THEN CREATE TYPE public.contract_status AS ENUM (
  'draft','scheduled','active','proof_pending','verified','rewarded','missed'
); END IF; END $t$;
DO $t$ BEGIN IF to_regtype('public.contract_session_status') IS NULL THEN CREATE TYPE public.contract_session_status AS ENUM ('active','completed','abandoned','expired'); END IF; END $t$;
DO $t$ BEGIN IF to_regtype('public.proof_status') IS NULL THEN CREATE TYPE public.proof_status AS ENUM ('submitted','verified','needs_review','retry_requested','rejected','unavailable'); END IF; END $t$;
DO $t$ BEGIN IF to_regtype('public.accountability_status') IS NULL THEN CREATE TYPE public.accountability_status AS ENUM ('active','revoked','blocked'); END IF; END $t$;

CREATE TABLE IF NOT EXISTS public.daily_contracts (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_id                 uuid REFERENCES public.goals(id) ON DELETE SET NULL,
  title                   text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
  category                text NOT NULL CHECK (category IN ('study','work','workout','meditation','reading','creative','other')),
  scheduled_at            timestamptz NOT NULL,
  timezone                text NOT NULL,
  local_day               date NOT NULL,
  planned_seconds         integer NOT NULL CHECK (planned_seconds BETWEEN 300 AND 14400),
  rescue_seconds          integer NOT NULL CHECK (rescue_seconds BETWEEN 60 AND 3600),
  trigger_text            text CHECK (char_length(trigger_text) <= 200),
  proof_method            text NOT NULL CHECK (proof_method IN ('timer','timer_recall','checklist','photo','zen_session')),
  difficulty              smallint NOT NULL DEFAULT 2 CHECK (difficulty BETWEEN 1 AND 3),
  accountability_enabled  boolean NOT NULL DEFAULT false,
  private_note            text CHECK (char_length(private_note) <= 500),
  status                  public.contract_status NOT NULL DEFAULT 'draft',
  is_recovery             boolean NOT NULL DEFAULT false,
  recovery_of_id          uuid REFERENCES public.daily_contracts(id) ON DELETE RESTRICT,
  xp_awarded              integer NOT NULL DEFAULT 0 CHECK (xp_awarded >= 0),
  coins_awarded           integer NOT NULL DEFAULT 0 CHECK (coins_awarded >= 0),
  started_at              timestamptz,
  completed_at            timestamptz,
  rewarded_at             timestamptz,
  expires_at              timestamptz,
  version                 integer NOT NULL DEFAULT 1,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dc_rescue_lt_planned CHECK (rescue_seconds < planned_seconds),
  CONSTRAINT dc_recovery_shape CHECK (
    (is_recovery = false AND recovery_of_id IS NULL) OR
    (is_recovery = true  AND recovery_of_id IS NOT NULL AND recovery_of_id <> id)
  ),
  CONSTRAINT dc_reward_shape CHECK (
    (status = 'rewarded' AND rewarded_at IS NOT NULL) OR (status <> 'rewarded' AND rewarded_at IS NULL)
  )
);

CREATE TABLE IF NOT EXISTS public.contract_sessions (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id        uuid NOT NULL REFERENCES public.daily_contracts(id) ON DELETE CASCADE,
  user_id            uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at         timestamptz NOT NULL DEFAULT now(),
  expected_end_at    timestamptz NOT NULL,
  ended_at           timestamptz,
  elapsed_seconds    integer CHECK (elapsed_seconds >= 0),
  exit_reason        text CHECK (exit_reason IN ('completed','stuck','emergency','user_ended','expired')),
  session_status     public.contract_session_status NOT NULL DEFAULT 'active',
  client_instance_id text CHECK (char_length(client_instance_id) <= 64),
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.proof_submissions (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id          uuid NOT NULL REFERENCES public.daily_contracts(id) ON DELETE CASCADE,
  session_id           uuid REFERENCES public.contract_sessions(id) ON DELETE SET NULL,
  user_id              uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  proof_type           text NOT NULL CHECK (proof_type IN ('timer','timer_recall','checklist','photo','zen_session')),
  private_storage_path text CHECK (private_storage_path IS NULL OR private_storage_path ~ '^[0-9a-f-]{36}/'),
  text_evidence        text CHECK (char_length(text_evidence) <= 2000),
  status               public.proof_status NOT NULL DEFAULT 'submitted',
  confidence           numeric(4,3) CHECK (confidence BETWEEN 0 AND 1),
  reason_code          text,
  verifier_version     text,
  retry_count          integer NOT NULL DEFAULT 0 CHECK (retry_count BETWEEN 0 AND 5),
  created_at           timestamptz NOT NULL DEFAULT now(),
  verified_at          timestamptz
);

CREATE TABLE IF NOT EXISTS public.recovery_events (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  original_contract_id uuid NOT NULL UNIQUE REFERENCES public.daily_contracts(id) ON DELETE CASCADE,
  recovery_contract_id uuid NOT NULL UNIQUE REFERENCES public.daily_contracts(id) ON DELETE CASCADE,
  reason               text CHECK (char_length(reason) <= 200),
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.accountability_invites (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash   text NOT NULL UNIQUE CHECK (char_length(token_hash) = 64),
  expires_at   timestamptz NOT NULL,
  accepted_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  accepted_at  timestamptz,
  revoked_at   timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_no_self CHECK (accepted_by IS NULL OR accepted_by <> inviter_id),
  CONSTRAINT ai_accept_shape CHECK ((accepted_by IS NULL) = (accepted_at IS NULL))
);

CREATE TABLE IF NOT EXISTS public.accountability_connections (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  partner_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invite_id   uuid REFERENCES public.accountability_invites(id) ON DELETE SET NULL,
  status      public.accountability_status NOT NULL DEFAULT 'active',
  share_status  boolean NOT NULL DEFAULT true,
  share_streak  boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  ended_at    timestamptz,
  CONSTRAINT acn_no_self CHECK (user_id <> partner_id)
);

CREATE TABLE IF NOT EXISTS public.accountability_events (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id  uuid NOT NULL REFERENCES public.accountability_connections(id) ON DELETE CASCADE,
  actor_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind           text NOT NULL CHECK (kind IN ('nudge','cheer','contract_verified','contract_missed','connected','revoked')),
  message        text CHECK (char_length(message) <= 140),
  contract_id    uuid REFERENCES public.daily_contracts(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT aev_no_self CHECK (actor_id <> recipient_id)
);

CREATE TABLE IF NOT EXISTS public.contract_events (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  contract_id  uuid NOT NULL REFERENCES public.daily_contracts(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind         text NOT NULL CHECK (kind IN ('created','scheduled','unscheduled','started','ended','proof_submitted',
                                             'proof_verified','proof_rejected','rewarded','missed','recovery_started')),
  from_status  public.contract_status,
  to_status    public.contract_status,
  meta         jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS dc_user_day_idx      ON public.daily_contracts(user_id, local_day DESC);
CREATE INDEX IF NOT EXISTS dc_status_idx        ON public.daily_contracts(status, scheduled_at);
CREATE INDEX IF NOT EXISTS dc_goal_idx          ON public.daily_contracts(goal_id) WHERE goal_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS dc_created_idx       ON public.daily_contracts(created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS dc_one_primary_per_day ON public.daily_contracts(user_id, local_day) WHERE is_recovery = false;
CREATE UNIQUE INDEX IF NOT EXISTS dc_one_recovery_per_original ON public.daily_contracts(recovery_of_id) WHERE recovery_of_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS cs_contract_idx      ON public.contract_sessions(contract_id);
CREATE INDEX IF NOT EXISTS cs_user_idx          ON public.contract_sessions(user_id, started_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS cs_one_active_per_user ON public.contract_sessions(user_id) WHERE session_status = 'active';
CREATE INDEX IF NOT EXISTS ps_contract_idx      ON public.proof_submissions(contract_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ps_user_idx          ON public.proof_submissions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ps_session_idx       ON public.proof_submissions(session_id) WHERE session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS re_user_idx          ON public.recovery_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ai_inviter_idx       ON public.accountability_invites(inviter_id, created_at DESC);
CREATE INDEX IF NOT EXISTS acn_user_idx         ON public.accountability_connections(user_id);
CREATE INDEX IF NOT EXISTS acn_partner_idx      ON public.accountability_connections(partner_id);
CREATE UNIQUE INDEX IF NOT EXISTS acn_one_active_user    ON public.accountability_connections(user_id)    WHERE status = 'active';
CREATE UNIQUE INDEX IF NOT EXISTS acn_one_active_partner ON public.accountability_connections(partner_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS aev_recipient_idx    ON public.accountability_events(recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS aev_actor_idx        ON public.accountability_events(actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS aev_connection_idx   ON public.accountability_events(connection_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ce_contract_idx      ON public.contract_events(contract_id, created_at);
CREATE INDEX IF NOT EXISTS ce_user_idx          ON public.contract_events(user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.axen_is_server_write()
RETURNS boolean
LANGUAGE sql STABLE
SET search_path = ''
AS $$
  SELECT current_user NOT IN ('authenticated','anon')
     AND coalesce(current_setting('axen.contract_write', true), 'off') = 'on';
$$;
REVOKE ALL ON FUNCTION public.axen_is_server_write() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.axen_is_server_write() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.guard_contract_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  _server boolean := public.axen_is_server_write();
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name = NEW.timezone) THEN
    RAISE EXCEPTION 'invalid timezone %', NEW.timezone USING ERRCODE = '22023';
  END IF;
  NEW.local_day := (NEW.scheduled_at AT TIME ZONE NEW.timezone)::date;
  NEW.updated_at := now();

  IF NEW.goal_id IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM public.goals g WHERE g.id = NEW.goal_id AND g.user_id = NEW.user_id) THEN
    RAISE EXCEPTION 'goal does not belong to user' USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NOT _server THEN
      IF NEW.user_id IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'user_id must be caller' USING ERRCODE = '42501';
      END IF;
      IF NEW.status NOT IN ('draft','scheduled')
         OR NEW.is_recovery OR NEW.recovery_of_id IS NOT NULL
         OR NEW.xp_awarded <> 0 OR NEW.coins_awarded <> 0
         OR NEW.started_at IS NOT NULL OR NEW.completed_at IS NOT NULL
         OR NEW.rewarded_at IS NOT NULL OR NEW.expires_at IS NOT NULL
         OR NEW.version <> 1 THEN
        RAISE EXCEPTION 'server-only fields cannot be set by client' USING ERRCODE = '42501';
      END IF;
      IF NEW.scheduled_at < now() - interval '5 minutes' THEN
        RAISE EXCEPTION 'scheduled_at in the past' USING ERRCODE = '22023';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.id <> OLD.id OR NEW.user_id <> OLD.user_id OR NEW.created_at <> OLD.created_at THEN
    RAISE EXCEPTION 'immutable column changed' USING ERRCODE = '42501';
  END IF;
  IF NEW.is_recovery IS DISTINCT FROM OLD.is_recovery
     OR NEW.recovery_of_id IS DISTINCT FROM OLD.recovery_of_id THEN
    RAISE EXCEPTION 'recovery flags are immutable' USING ERRCODE = '42501';
  END IF;
  IF OLD.status = 'rewarded' AND (NEW.status <> 'rewarded'
       OR NEW.xp_awarded <> OLD.xp_awarded OR NEW.coins_awarded <> OLD.coins_awarded
       OR NEW.rewarded_at IS DISTINCT FROM OLD.rewarded_at) THEN
    RAISE EXCEPTION 'rewarded contract is final' USING ERRCODE = '42501';
  END IF;

  IF NOT _server THEN
    IF OLD.user_id <> auth.uid() THEN
      RAISE EXCEPTION 'not owner' USING ERRCODE = '42501';
    END IF;
    IF NEW.xp_awarded <> OLD.xp_awarded OR NEW.coins_awarded <> OLD.coins_awarded
       OR NEW.rewarded_at IS DISTINCT FROM OLD.rewarded_at
       OR NEW.completed_at IS DISTINCT FROM OLD.completed_at
       OR NEW.started_at IS DISTINCT FROM OLD.started_at
       OR NEW.expires_at IS DISTINCT FROM OLD.expires_at
       OR NEW.version <> OLD.version THEN
      RAISE EXCEPTION 'server-only fields cannot be changed by client' USING ERRCODE = '42501';
    END IF;
    IF OLD.status NOT IN ('draft','scheduled') THEN
      RAISE EXCEPTION 'contract locked in status %', OLD.status USING ERRCODE = '42501';
    END IF;
    IF NEW.status NOT IN ('draft','scheduled') THEN
      RAISE EXCEPTION 'status % is server-only', NEW.status USING ERRCODE = '42501';
    END IF;
    IF NEW.scheduled_at IS DISTINCT FROM OLD.scheduled_at AND NEW.scheduled_at < now() - interval '5 minutes' THEN
      RAISE EXCEPTION 'scheduled_at in the past' USING ERRCODE = '22023';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.status <> OLD.status AND NOT (
       (OLD.status = 'draft'         AND NEW.status IN ('scheduled')) OR
       (OLD.status = 'scheduled'     AND NEW.status IN ('draft','active','missed')) OR
       (OLD.status = 'active'        AND NEW.status IN ('proof_pending','missed')) OR
       (OLD.status = 'proof_pending' AND NEW.status IN ('verified','missed')) OR
       (OLD.status = 'verified'      AND NEW.status IN ('rewarded'))
     ) THEN
    RAISE EXCEPTION 'invalid transition % -> %', OLD.status, NEW.status USING ERRCODE = '22023';
  END IF;
  IF NEW.status <> OLD.status THEN
    NEW.version := OLD.version + 1;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_contract_fields() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_guard_contract_fields ON public.daily_contracts;
CREATE TRIGGER trg_guard_contract_fields BEFORE INSERT OR UPDATE ON public.daily_contracts
  FOR EACH ROW EXECUTE FUNCTION public.guard_contract_fields();

CREATE OR REPLACE FUNCTION public.guard_contract_sessions()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NOT public.axen_is_server_write() THEN
    RAISE EXCEPTION 'contract_sessions are server-written only' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'contract_sessions are append-only' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NOT EXISTS (SELECT 1 FROM public.daily_contracts c
                   WHERE c.id = NEW.contract_id AND c.user_id = NEW.user_id) THEN
      RAISE EXCEPTION 'session contract ownership mismatch' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;
  IF OLD.session_status <> 'active' THEN
    RAISE EXCEPTION 'closed session is immutable' USING ERRCODE = '42501';
  END IF;
  IF NEW.contract_id <> OLD.contract_id OR NEW.user_id <> OLD.user_id
     OR NEW.started_at <> OLD.started_at OR NEW.expected_end_at <> OLD.expected_end_at
     OR NEW.created_at <> OLD.created_at THEN
    RAISE EXCEPTION 'session evidence is immutable' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_contract_sessions() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_guard_contract_sessions ON public.contract_sessions;
CREATE TRIGGER trg_guard_contract_sessions BEFORE INSERT OR UPDATE OR DELETE ON public.contract_sessions
  FOR EACH ROW EXECUTE FUNCTION public.guard_contract_sessions();

CREATE OR REPLACE FUNCTION public.guard_proof_submission()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  _server boolean := public.axen_is_server_write();
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT _server AND NEW.user_id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'user_id must be caller' USING ERRCODE = '42501';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.daily_contracts c
                   WHERE c.id = NEW.contract_id AND c.user_id = NEW.user_id
                     AND c.status IN ('active','proof_pending')) THEN
      RAISE EXCEPTION 'contract not owned or not awaiting proof' USING ERRCODE = '42501';
    END IF;
    IF NEW.session_id IS NOT NULL AND NOT EXISTS (
         SELECT 1 FROM public.contract_sessions s
         WHERE s.id = NEW.session_id AND s.user_id = NEW.user_id AND s.contract_id = NEW.contract_id) THEN
      RAISE EXCEPTION 'session not owned or belongs to another contract' USING ERRCODE = '42501';
    END IF;
    IF NEW.private_storage_path IS NOT NULL
       AND split_part(NEW.private_storage_path, '/', 1) <> NEW.user_id::text THEN
      RAISE EXCEPTION 'storage path outside owner prefix' USING ERRCODE = '42501';
    END IF;
    IF NOT _server THEN
      NEW.status := 'submitted';
      NEW.confidence := NULL; NEW.reason_code := NULL;
      NEW.verifier_version := NULL; NEW.verified_at := NULL; NEW.retry_count := 0;
    END IF;
    RETURN NEW;
  END IF;

  IF NOT _server THEN
    RAISE EXCEPTION 'proof status is server-only' USING ERRCODE = '42501';
  END IF;
  IF NEW.contract_id <> OLD.contract_id OR NEW.user_id <> OLD.user_id
     OR NEW.session_id IS DISTINCT FROM OLD.session_id
     OR NEW.private_storage_path IS DISTINCT FROM OLD.private_storage_path
     OR NEW.text_evidence IS DISTINCT FROM OLD.text_evidence
     OR NEW.proof_type <> OLD.proof_type THEN
    RAISE EXCEPTION 'proof evidence is immutable' USING ERRCODE = '42501';
  END IF;
  IF OLD.status IN ('verified','rejected') AND NEW.status <> OLD.status THEN
    RAISE EXCEPTION 'final proof status' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_proof_submission() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_guard_proof_submission ON public.proof_submissions;
CREATE TRIGGER trg_guard_proof_submission BEFORE INSERT OR UPDATE ON public.proof_submissions
  FOR EACH ROW EXECUTE FUNCTION public.guard_proof_submission();

CREATE OR REPLACE FUNCTION public.guard_append_only_server()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP IN ('UPDATE','DELETE') THEN
    RAISE EXCEPTION '% is append-only', TG_TABLE_NAME USING ERRCODE = '42501';
  END IF;
  IF NOT public.axen_is_server_write() THEN
    RAISE EXCEPTION '% is server-written only', TG_TABLE_NAME USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_append_only_server() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_append_only_contract_events ON public.contract_events;
CREATE TRIGGER trg_append_only_contract_events BEFORE INSERT OR UPDATE OR DELETE ON public.contract_events
  FOR EACH ROW EXECUTE FUNCTION public.guard_append_only_server();
DROP TRIGGER IF EXISTS trg_append_only_recovery_events ON public.recovery_events;
CREATE TRIGGER trg_append_only_recovery_events BEFORE INSERT OR UPDATE OR DELETE ON public.recovery_events
  FOR EACH ROW EXECUTE FUNCTION public.guard_append_only_server();
DROP TRIGGER IF EXISTS trg_append_only_accountability_events ON public.accountability_events;
CREATE TRIGGER trg_append_only_accountability_events BEFORE INSERT OR UPDATE OR DELETE ON public.accountability_events
  FOR EACH ROW EXECUTE FUNCTION public.guard_append_only_server();

CREATE OR REPLACE FUNCTION public.guard_server_only_rows()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NOT public.axen_is_server_write() THEN
    RAISE EXCEPTION '% is server-written only', TG_TABLE_NAME USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_server_only_rows() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_server_only_invites ON public.accountability_invites;
CREATE TRIGGER trg_server_only_invites BEFORE INSERT OR UPDATE OR DELETE ON public.accountability_invites
  FOR EACH ROW EXECUTE FUNCTION public.guard_server_only_rows();
DROP TRIGGER IF EXISTS trg_server_only_connections ON public.accountability_connections;
CREATE TRIGGER trg_server_only_connections BEFORE INSERT OR UPDATE OR DELETE ON public.accountability_connections
  FOR EACH ROW EXECUTE FUNCTION public.guard_server_only_rows();

CREATE OR REPLACE FUNCTION public.log_contract_event(_contract uuid, _user uuid, _kind text,
                                          _from public.contract_status, _to public.contract_status,
                                          _meta jsonb DEFAULT '{}'::jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM pg_catalog.set_config('axen.contract_write', 'on', true);
  INSERT INTO public.contract_events(contract_id, user_id, kind, from_status, to_status, meta)
  VALUES (_contract, _user, _kind, _from, _to, coalesce(_meta, '{}'::jsonb));
END;
$$;
REVOKE ALL ON FUNCTION public.log_contract_event(uuid, uuid, text, public.contract_status, public.contract_status, jsonb)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.start_contract_session(_contract_id uuid, _client_instance text DEFAULT NULL)
RETURNS public.contract_sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
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

  PERFORM pg_catalog.set_config('axen.contract_write', 'on', true);
  INSERT INTO public.contract_sessions(contract_id, user_id, started_at, expected_end_at, client_instance_id)
  VALUES (_c.id, _uid, now(), now() + pg_catalog.make_interval(secs => _c.planned_seconds), left(_client_instance, 64))
  RETURNING * INTO _s;

  UPDATE public.daily_contracts SET status = 'active', started_at = now() WHERE id = _c.id;
  PERFORM public.log_contract_event(_c.id, _uid, 'started', 'scheduled', 'active',
                                    pg_catalog.jsonb_build_object('session_id', _s.id));
  RETURN _s;
END;
$$;

CREATE OR REPLACE FUNCTION public.end_contract_session(_session_id uuid, _reason text)
RETURNS public.contract_sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.verify_contract_proof(_proof_id uuid, _status public.proof_status,
                                             _confidence numeric, _reason text, _verifier text)
RETURNS public.proof_submissions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _p public.proof_submissions;
  _c public.daily_contracts;
BEGIN
  IF _status NOT IN ('verified','needs_review','retry_requested','rejected','unavailable') THEN
    RAISE EXCEPTION 'invalid proof status' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO _p FROM public.proof_submissions WHERE id = _proof_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'proof not found'; END IF;
  IF _p.status IN ('verified','rejected') THEN RETURN _p; END IF;
  PERFORM pg_catalog.set_config('axen.contract_write', 'on', true);
  UPDATE public.proof_submissions
     SET status = _status, confidence = _confidence, reason_code = left(_reason, 64),
         verifier_version = left(_verifier, 32), verified_at = now(),
         retry_count = CASE WHEN _status = 'retry_requested' THEN LEAST(retry_count + 1, 5) ELSE retry_count END
   WHERE id = _p.id RETURNING * INTO _p;
  SELECT * INTO _c FROM public.daily_contracts WHERE id = _p.contract_id FOR UPDATE;
  IF _status = 'verified' AND _c.status = 'proof_pending' THEN
    UPDATE public.daily_contracts SET status = 'verified', completed_at = now() WHERE id = _c.id;
    PERFORM public.log_contract_event(_c.id, _c.user_id, 'proof_verified', 'proof_pending', 'verified',
      pg_catalog.jsonb_build_object('proof_id', _p.id));
  ELSIF _status = 'rejected' THEN
    PERFORM public.log_contract_event(_c.id, _c.user_id, 'proof_rejected', _c.status, _c.status,
      pg_catalog.jsonb_build_object('proof_id', _p.id, 'reason', _reason));
  END IF;
  RETURN _p;
END;
$$;

CREATE OR REPLACE FUNCTION public.award_contract(_contract_id uuid)
RETURNS TABLE(xp integer, coins integer, already_awarded boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _uid uuid := auth.uid();
  _c   public.daily_contracts;
  _xp  integer;
  _co  integer;
  _key text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501'; END IF;
  SELECT * INTO _c FROM public.daily_contracts WHERE id = _contract_id AND user_id = _uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'contract not found' USING ERRCODE = '42501'; END IF;
  IF _c.status = 'rewarded' THEN
    RETURN QUERY SELECT _c.xp_awarded, _c.coins_awarded, true; RETURN;
  END IF;
  IF _c.status <> 'verified' THEN RAISE EXCEPTION 'contract not verified' USING ERRCODE = '22023'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.proof_submissions p
                 WHERE p.contract_id = _c.id AND p.user_id = _uid AND p.status = 'verified') THEN
    RAISE EXCEPTION 'no verified proof' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.contract_sessions s
                 WHERE s.contract_id = _c.id AND s.user_id = _uid AND s.session_status = 'completed') THEN
    RAISE EXCEPTION 'no completed session' USING ERRCODE = '22023';
  END IF;

  _xp := CASE WHEN _c.is_recovery THEN 8 ELSE 20 END;
  _co := CASE WHEN _c.is_recovery THEN 2 ELSE 5 END;
  _key := 'contract:' || _c.id::text;

  PERFORM pg_catalog.set_config('axen.contract_write', 'on', true);
  PERFORM pg_catalog.set_config('app.economy_write', 'on', true);

  INSERT INTO public.score_events(user_id, points, kind, idempotency_key)
  VALUES (_uid, _xp, CASE WHEN _c.is_recovery THEN 'contract_recovery' ELSE 'contract_verified' END, _key)
  ON CONFLICT (idempotency_key) DO NOTHING;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'reward ledger conflict' USING ERRCODE = '23505';
  END IF;
  INSERT INTO public.coin_transactions(user_id, amount, reason, ref_id)
  VALUES (_uid, _co, 'contract_reward', _c.id);
  UPDATE public.profiles SET coins = coins + _co WHERE id = _uid;

  UPDATE public.daily_contracts
     SET status = 'rewarded', xp_awarded = _xp, coins_awarded = _co, rewarded_at = now()
   WHERE id = _c.id;
  PERFORM public.log_contract_event(_c.id, _uid, 'rewarded', 'verified', 'rewarded',
    pg_catalog.jsonb_build_object('xp', _xp, 'coins', _co));
  RETURN QUERY SELECT _xp, _co, false;
END;
$$;

CREATE OR REPLACE FUNCTION public.start_recovery(_original_id uuid, _reason text DEFAULT NULL)
RETURNS public.daily_contracts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _uid uuid := auth.uid();
  _o   public.daily_contracts;
  _r   public.daily_contracts;
  _secs integer;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501'; END IF;
  SELECT * INTO _o FROM public.daily_contracts WHERE id = _original_id AND user_id = _uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'contract not found' USING ERRCODE = '42501'; END IF;
  IF _o.is_recovery THEN RAISE EXCEPTION 'cannot recover a recovery' USING ERRCODE = '22023'; END IF;
  IF _o.status <> 'missed' THEN RAISE EXCEPTION 'only missed contracts can be recovered' USING ERRCODE = '22023'; END IF;
  IF (now() AT TIME ZONE _o.timezone)::date <> _o.local_day THEN
    RAISE EXCEPTION 'recovery window closed' USING ERRCODE = '22023';
  END IF;
  _secs := GREATEST(300, (_o.planned_seconds * 0.2)::integer);

  PERFORM pg_catalog.set_config('axen.contract_write', 'on', true);
  INSERT INTO public.daily_contracts(user_id, goal_id, title, category, scheduled_at, timezone, local_day,
      planned_seconds, rescue_seconds, trigger_text, proof_method, difficulty, status,
      is_recovery, recovery_of_id, expires_at)
  VALUES (_uid, _o.goal_id, left('Recovery: ' || _o.title, 120), _o.category, now(), _o.timezone, _o.local_day,
      _secs, LEAST(_secs - 1, 240), _o.trigger_text, _o.proof_method, _o.difficulty, 'scheduled',
      true, _o.id, ((_o.local_day + 1)::timestamp AT TIME ZONE _o.timezone))
  RETURNING * INTO _r;
  INSERT INTO public.recovery_events(user_id, original_contract_id, recovery_contract_id, reason)
  VALUES (_uid, _o.id, _r.id, left(_reason, 200));
  PERFORM public.log_contract_event(_o.id, _uid, 'recovery_started', 'missed', 'missed',
    pg_catalog.jsonb_build_object('recovery_id', _r.id));
  RETURN _r;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_accountability_invite(_token_hash text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _uid uuid := auth.uid();
  _id  uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501'; END IF;
  IF _token_hash !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'invalid token hash' USING ERRCODE = '22023'; END IF;
  IF (SELECT count(*) FROM public.accountability_invites
      WHERE inviter_id = _uid AND created_at > now() - interval '1 day') >= 5 THEN
    RAISE EXCEPTION 'invite rate limit' USING ERRCODE = '54000';
  END IF;
  PERFORM pg_catalog.set_config('axen.contract_write', 'on', true);
  INSERT INTO public.accountability_invites(inviter_id, token_hash, expires_at)
  VALUES (_uid, _token_hash, now() + interval '48 hours') RETURNING id INTO _id;
  RETURN _id;
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_accountability_invite(_token_hash text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _uid uuid := auth.uid();
  _i   public.accountability_invites;
  _cid uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501'; END IF;
  SELECT * INTO _i FROM public.accountability_invites WHERE token_hash = _token_hash FOR UPDATE;
  IF NOT FOUND OR _i.accepted_at IS NOT NULL OR _i.revoked_at IS NOT NULL OR _i.expires_at < now() THEN
    RAISE EXCEPTION 'invite invalid or used' USING ERRCODE = '22023';
  END IF;
  IF _i.inviter_id = _uid THEN RAISE EXCEPTION 'cannot accept own invite' USING ERRCODE = '22023'; END IF;
  IF EXISTS (SELECT 1 FROM public.accountability_connections
             WHERE status = 'active' AND (user_id IN (_uid, _i.inviter_id) OR partner_id IN (_uid, _i.inviter_id))) THEN
    RAISE EXCEPTION 'a user already has an active partner' USING ERRCODE = '23505';
  END IF;
  PERFORM pg_catalog.set_config('axen.contract_write', 'on', true);
  UPDATE public.accountability_invites SET accepted_by = _uid, accepted_at = now() WHERE id = _i.id;
  INSERT INTO public.accountability_connections(user_id, partner_id, invite_id)
  VALUES (_i.inviter_id, _uid, _i.id) RETURNING id INTO _cid;
  INSERT INTO public.accountability_events(connection_id, actor_id, recipient_id, kind)
  VALUES (_cid, _uid, _i.inviter_id, 'connected');
  RETURN _cid;
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_accountability_connection(_connection_id uuid, _block boolean DEFAULT false)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _uid uuid := auth.uid();
  _c   public.accountability_connections;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501'; END IF;
  SELECT * INTO _c FROM public.accountability_connections
   WHERE id = _connection_id AND (user_id = _uid OR partner_id = _uid) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'connection not found' USING ERRCODE = '42501'; END IF;
  IF _c.status <> 'active' THEN RETURN; END IF;
  PERFORM pg_catalog.set_config('axen.contract_write', 'on', true);
  UPDATE public.accountability_connections
     SET status = CASE WHEN _block THEN 'blocked'::public.accountability_status ELSE 'revoked'::public.accountability_status END,
         ended_at = now()
   WHERE id = _c.id;
  INSERT INTO public.accountability_events(connection_id, actor_id, recipient_id, kind)
  VALUES (_c.id, _uid, CASE WHEN _c.user_id = _uid THEN _c.partner_id ELSE _c.user_id END, 'revoked');
END;
$$;

CREATE OR REPLACE FUNCTION public.send_accountability_nudge(_connection_id uuid, _kind text, _message text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _uid uuid := auth.uid();
  _c   public.accountability_connections;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501'; END IF;
  IF _kind NOT IN ('nudge','cheer') THEN RAISE EXCEPTION 'invalid kind' USING ERRCODE = '22023'; END IF;
  SELECT * INTO _c FROM public.accountability_connections
   WHERE id = _connection_id AND status = 'active' AND (user_id = _uid OR partner_id = _uid);
  IF NOT FOUND THEN RAISE EXCEPTION 'no active connection' USING ERRCODE = '42501'; END IF;
  IF (SELECT count(*) FROM public.accountability_events
      WHERE connection_id = _c.id AND actor_id = _uid AND kind IN ('nudge','cheer')
        AND created_at > now() - interval '24 hours') >= 3 THEN
    RAISE EXCEPTION 'nudge rate limit' USING ERRCODE = '54000';
  END IF;
  PERFORM pg_catalog.set_config('axen.contract_write', 'on', true);
  INSERT INTO public.accountability_events(connection_id, actor_id, recipient_id, kind, message)
  VALUES (_c.id, _uid, CASE WHEN _c.user_id = _uid THEN _c.partner_id ELSE _c.user_id END, _kind, left(_message, 140));
END;
$$;

CREATE OR REPLACE FUNCTION public.get_partner_today()
RETURNS TABLE(partner_id uuid, status public.contract_status, local_day date)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT c.user_id, c.status, c.local_day
  FROM public.accountability_connections a
  JOIN public.daily_contracts c
    ON c.user_id = CASE WHEN a.user_id = auth.uid() THEN a.partner_id ELSE a.user_id END
  WHERE a.status = 'active' AND a.share_status
    AND (a.user_id = auth.uid() OR a.partner_id = auth.uid())
    AND c.accountability_enabled AND c.is_recovery = false
    AND c.local_day = (now() AT TIME ZONE c.timezone)::date;
$$;

REVOKE ALL ON FUNCTION public.start_contract_session(uuid, text)            FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.end_contract_session(uuid, text)              FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.verify_contract_proof(uuid, public.proof_status, numeric, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.award_contract(uuid)                          FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.start_recovery(uuid, text)                    FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_accountability_invite(text)            FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.accept_accountability_invite(text)            FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.revoke_accountability_connection(uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.send_accountability_nudge(uuid, text, text)   FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_partner_today()                           FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.start_contract_session(uuid, text)            TO authenticated;
GRANT EXECUTE ON FUNCTION public.end_contract_session(uuid, text)              TO authenticated;
GRANT EXECUTE ON FUNCTION public.award_contract(uuid)                          TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_recovery(uuid, text)                    TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_accountability_invite(text)            TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_accountability_invite(text)            TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_accountability_connection(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_accountability_nudge(uuid, text, text)   TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_partner_today()                           TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_contract_proof(uuid, public.proof_status, numeric, text, text) TO service_role;

REVOKE ALL ON public.daily_contracts            FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.contract_sessions          FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.proof_submissions          FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.recovery_events            FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.accountability_invites     FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.accountability_connections FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.accountability_events      FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.contract_events            FROM PUBLIC, anon, authenticated;

GRANT SELECT ON public.daily_contracts TO authenticated;
GRANT INSERT (user_id, goal_id, title, category, scheduled_at, timezone, local_day, planned_seconds,
              rescue_seconds, trigger_text, proof_method, difficulty, accountability_enabled,
              private_note, status)
  ON public.daily_contracts TO authenticated;
GRANT UPDATE (goal_id, title, category, scheduled_at, timezone, planned_seconds, rescue_seconds,
              trigger_text, proof_method, difficulty, accountability_enabled, private_note, status)
  ON public.daily_contracts TO authenticated;

GRANT SELECT ON public.contract_sessions TO authenticated;

GRANT SELECT ON public.proof_submissions TO authenticated;
GRANT INSERT (contract_id, session_id, user_id, proof_type, private_storage_path, text_evidence)
  ON public.proof_submissions TO authenticated;

GRANT SELECT ON public.recovery_events            TO authenticated;
GRANT SELECT ON public.accountability_invites     TO authenticated;
GRANT SELECT ON public.accountability_connections TO authenticated;
GRANT SELECT ON public.accountability_events      TO authenticated;
GRANT SELECT ON public.contract_events            TO authenticated;

GRANT ALL ON public.daily_contracts, public.contract_sessions, public.proof_submissions,
             public.recovery_events, public.accountability_invites, public.accountability_connections,
             public.accountability_events, public.contract_events TO service_role;
GRANT USAGE ON TYPE public.contract_status, public.contract_session_status,
                    public.proof_status, public.accountability_status TO authenticated, service_role;

ALTER TABLE public.daily_contracts            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_sessions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proof_submissions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recovery_events            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accountability_invites     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accountability_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accountability_events      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_events            ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dc_select_own ON public.daily_contracts;
CREATE POLICY dc_select_own ON public.daily_contracts FOR SELECT TO authenticated
  USING (user_id = auth.uid());
DROP POLICY IF EXISTS dc_insert_own ON public.daily_contracts;
CREATE POLICY dc_insert_own ON public.daily_contracts FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND is_recovery = false AND status IN ('draft','scheduled'));
DROP POLICY IF EXISTS dc_update_own_editable ON public.daily_contracts;
CREATE POLICY dc_update_own_editable ON public.daily_contracts FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND status IN ('draft','scheduled'))
  WITH CHECK (user_id = auth.uid() AND status IN ('draft','scheduled'));

DROP POLICY IF EXISTS cs_select_own ON public.contract_sessions;
CREATE POLICY cs_select_own ON public.contract_sessions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS ps_select_own ON public.proof_submissions;
CREATE POLICY ps_select_own ON public.proof_submissions FOR SELECT TO authenticated
  USING (user_id = auth.uid());
DROP POLICY IF EXISTS ps_insert_own ON public.proof_submissions;
CREATE POLICY ps_insert_own ON public.proof_submissions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS re_select_own ON public.recovery_events;
CREATE POLICY re_select_own ON public.recovery_events FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS ai_select_inviter ON public.accountability_invites;
CREATE POLICY ai_select_inviter ON public.accountability_invites FOR SELECT TO authenticated
  USING (inviter_id = auth.uid());

DROP POLICY IF EXISTS acn_select_member ON public.accountability_connections;
CREATE POLICY acn_select_member ON public.accountability_connections FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR partner_id = auth.uid());

DROP POLICY IF EXISTS aev_select_party ON public.accountability_events;
CREATE POLICY aev_select_party ON public.accountability_events FOR SELECT TO authenticated
  USING (actor_id = auth.uid() OR recipient_id = auth.uid());

DROP POLICY IF EXISTS ce_select_own ON public.contract_events;
CREATE POLICY ce_select_own ON public.contract_events FOR SELECT TO authenticated
  USING (user_id = auth.uid());