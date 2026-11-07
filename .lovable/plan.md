# Batch A — answers + COMPLETE revised SQL (NOT run; waiting for "run it")

This file is the complete SQL. It ends with the line `-- END OF BATCH A MIGRATION`.

## Answers to your 8 points (all read-only checks)

**1. Permissions** — fixed in section 9 of the SQL. Internal functions: no access for PUBLIC, anon or authenticated. Signed-in users get only the 5 user actions. After running I will show `has_function_privilege()` for anon and authenticated on all 12 functions, plus a test that a normal user calling `acct_stake_ledger` is refused and cannot add coins to anyone.

**2. Sweep** — each stake is settled inside its own `BEGIN … EXCEPTION` block. A failure is written to a private error table and the sweep continues.

**3. What is recorded when a contract finishes today**
- User taps Start → `contract_sessions` row; `daily_contracts.started_at`, status `active`.
- Timer ends → `end_contract_session` sets `contract_sessions.ended_at` and `session_status='completed'`; contract becomes `proof_pending`. This is the **user-side completion time**.
- User submits proof → `proof_submissions.created_at` (user-side). The server verifier then sets status `verified`; `award_contract` sets `rewarded` and `rewarded_at` (server/reviewer side).
- `daily_contracts.completed_at` is not written by any current function, so it is not used.
- Rule used: on time = the **earliest** of (first completed session `ended_at`, first proof `created_at`) is at or before the deadline. A contract with no proof row still counts by its session end. Reviewer/verification time is never used.

**4. Economy — how it is calculated today**
- Lifetime Coins (Stats, Profile): app adds up every positive coin row of the user. A stake return/release would inflate it → the app query will exclude `solo_stake_hold/release/return` (only the bonus counts). One-line change in `dashboard.tsx`.
- Leaderboard / rank points (`leaderboard_scores`): positive coin rows + XP. Same exclusion added.
- Rank badge (`rank_verification_badges`) and Verified Rank List coins (`get_verified_rank_coins`): use the current coin balance → would drop while coins are held. Both now use balance + currently held stake.
- Seals (`sync_milestone_seals`): permanent, never removed; now also counts held stake so a threshold reached while coins are held still unlocks.
- XP (`score_events`) is untouched by stakes.

**5. Write path** — today the Home contract card writes directly to contracts (insert/update), and the existing guard checks every client write (owner only, no server-only fields, no past time, status rules). The 5 new fields are not server-only, so they pass the guard. For the Pact Creator I add `acct_create_pact` that runs **as the user** (not elevated), so the same guard and access rules apply — no bypass.

**6. pg_cron** — installed, version 1.6.4. No jobs exist yet. `cron.schedule` will be proven by reading back the job after running. Cadence: every 5 minutes = 288 runs/day. Needed because nothing else marks never-started pacts as missed; max delay for a stake to settle is about 5 minutes (it also settles instantly on app open and on any status change). It does keep the database a little busier.

**7. Invites** — `accept_accountability_invite_v2` keeps every guard of the old one: locked row, single use, revoked/expired/self rejected, both sides must have no partner. The old accept has no rate limit; v2 adds one: max 10 failed attempts per user per hour, then a 1-hour lockout. Invite codes are 16 random bytes = **128-bit** (32 hex characters); only a hash is stored. No short codes are used.

**8. Backup** — please export first: More → Database → Manage → Settings → Export data. Test list after "run it" is at the bottom.

## Complete SQL

```sql
-- ===== 1. Pact fields on existing contracts (single source of truth) =====
ALTER TABLE public.daily_contracts
  ADD COLUMN IF NOT EXISTS is_solo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS partner_visibility text NOT NULL DEFAULT 'private'
    CHECK (partner_visibility IN ('private','partner')),
  ADD COLUMN IF NOT EXISTS minimum_version text CHECK (char_length(minimum_version) <= 140),
  ADD COLUMN IF NOT EXISTS obstacles text CHECK (char_length(obstacles) <= 280),
  ADD COLUMN IF NOT EXISTS evidence_required text NOT NULL DEFAULT 'none'
    CHECK (evidence_required IN ('none','checkin','photo','document','session')),
  ADD COLUMN IF NOT EXISTS paused_at timestamptz;

-- ===== 2. Roles (stored; Supporter not offered until Batch B) =====
ALTER TABLE public.accountability_connections
  ADD COLUMN IF NOT EXISTS role_of_user text NOT NULL DEFAULT 'reviewer'
    CHECK (role_of_user IN ('reviewer','supporter')),
  ADD COLUMN IF NOT EXISTS role_of_partner text NOT NULL DEFAULT 'reviewer'
    CHECK (role_of_partner IN ('reviewer','supporter'));
ALTER TABLE public.accountability_invites
  ADD COLUMN IF NOT EXISTS invitee_role text NOT NULL DEFAULT 'reviewer'
    CHECK (invitee_role IN ('reviewer','supporter'));

-- ===== 3. Tables =====
CREATE TABLE public.solo_pact_stakes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL UNIQUE REFERENCES public.daily_contracts(id),
  user_id uuid NOT NULL,
  amount integer NOT NULL DEFAULT 0 CHECK (amount IN (0,10,25,50)),
  pending_amount integer CHECK (pending_amount IN (0,10,25,50)),
  pending_effective_at timestamptz,
  state text NOT NULL DEFAULT 'held' CHECK (state IN ('held','returned','burned','released')),
  outcome_reason text,
  version integer NOT NULL DEFAULT 1,
  settled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.solo_stake_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stake_id uuid NOT NULL REFERENCES public.solo_pact_stakes(id),
  user_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('hold','topup','lower_requested','release','return','bonus','burn')),
  coins integer NOT NULL CHECK (coins >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.solo_stake_sweep_errors (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  stake_id uuid NOT NULL,
  sqlstate text,
  message text,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.invite_accept_attempts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL,
  succeeded boolean NOT NULL,
  attempted_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.solo_pact_stakes, public.solo_stake_changes TO authenticated;
GRANT ALL ON public.solo_pact_stakes, public.solo_stake_changes,
  public.solo_stake_sweep_errors, public.invite_accept_attempts TO service_role;
ALTER TABLE public.solo_pact_stakes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solo_stake_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solo_stake_sweep_errors ENABLE ROW LEVEL SECURITY;   -- no policies: server only
ALTER TABLE public.invite_accept_attempts ENABLE ROW LEVEL SECURITY;    -- no policies: server only
CREATE POLICY "own stake read" ON public.solo_pact_stakes FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own stake change read" ON public.solo_stake_changes FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE INDEX solo_stake_held_idx ON public.solo_pact_stakes (user_id) WHERE state = 'held';
CREATE INDEX invite_attempts_user_time_idx ON public.invite_accept_attempts (user_id, attempted_at DESC);

-- Ledger once-only: hold/release keyed by change id; return/bonus keyed by stake id
CREATE UNIQUE INDEX IF NOT EXISTS coin_solo_stake_once ON public.coin_transactions (user_id, reason, ref_id)
  WHERE reason IN ('solo_stake_hold','solo_stake_release','solo_stake_return','solo_stake_bonus');

-- ===== 4. Internal coin + stake helpers =====
CREATE OR REPLACE FUNCTION public.acct_stake_ledger(_uid uuid, _delta integer, _reason text, _ref uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE _bal integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(_uid::text,74010));
  SELECT coins INTO _bal FROM public.profiles WHERE id = _uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'profile not found' USING ERRCODE='P0002'; END IF;
  IF _bal + _delta < 0 THEN RAISE EXCEPTION 'Not enough coins' USING ERRCODE='22003'; END IF;
  PERFORM set_config('app.economy_write','on',true);
  PERFORM set_config('axen.contract_write','on',true);
  INSERT INTO public.coin_transactions(user_id, amount, reason, ref_id) VALUES (_uid, _delta, _reason, _ref);
  UPDATE public.profiles SET coins = coins + _delta WHERE id = _uid;
END $$;

CREATE OR REPLACE FUNCTION public.acct_held_coins(_uid uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
  SELECT coalesce(sum(amount),0)::int FROM public.solo_pact_stakes WHERE user_id=_uid AND state='held';
$$;

CREATE OR REPLACE FUNCTION public.acct_user_done_at(_contract_id uuid, _uid uuid)
RETURNS timestamptz LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
  SELECT least(
    (SELECT min(ended_at) FROM public.contract_sessions
      WHERE contract_id=_contract_id AND user_id=_uid AND session_status='completed'),
    (SELECT min(created_at) FROM public.proof_submissions
      WHERE contract_id=_contract_id AND user_id=_uid));
$$;

CREATE OR REPLACE FUNCTION public.acct_request_stake_lower(_s public.solo_pact_stakes, _amount integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  IF _s.state <> 'held' OR _amount >= _s.amount THEN RETURN; END IF;
  UPDATE public.solo_pact_stakes
     SET pending_amount = least(coalesce(pending_amount, _amount), _amount),
         pending_effective_at = coalesce(pending_effective_at, now() + interval '24 hours'),
         version = version + 1, updated_at = now()
   WHERE id = _s.id;
  INSERT INTO public.solo_stake_changes(stake_id,user_id,kind,coins)
  VALUES (_s.id,_s.user_id,'lower_requested',_s.amount-_amount);
END $$;

CREATE OR REPLACE FUNCTION public.acct_stake_pay_back(_s public.solo_pact_stakes, _why text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE _bonus integer := greatest(1, floor(_s.amount * 0.1)::int);
BEGIN
  INSERT INTO public.solo_stake_changes(stake_id,user_id,kind,coins) VALUES (_s.id,_s.user_id,'return',_s.amount);
  PERFORM public.acct_stake_ledger(_s.user_id, _s.amount, 'solo_stake_return', _s.id);
  INSERT INTO public.solo_stake_changes(stake_id,user_id,kind,coins) VALUES (_s.id,_s.user_id,'bonus',_bonus);
  PERFORM public.acct_stake_ledger(_s.user_id, _bonus, 'solo_stake_bonus', _s.id);
  UPDATE public.solo_pact_stakes SET state='returned', outcome_reason=_why, settled_at=now(),
    version=version+1, updated_at=now() WHERE id=_s.id;
END $$;

CREATE OR REPLACE FUNCTION public.acct_stake_burn(_s public.solo_pact_stakes, _why text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  INSERT INTO public.solo_stake_changes(stake_id,user_id,kind,coins) VALUES (_s.id,_s.user_id,'burn',_s.amount);
  UPDATE public.solo_pact_stakes SET state='burned', outcome_reason=_why, settled_at=now(),
    version=version+1, updated_at=now() WHERE id=_s.id;
END $$;

-- ===== 5. Settlement (idempotent; safe to call repeatedly) =====
CREATE OR REPLACE FUNCTION public.acct_settle_stake(_stake_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE _s public.solo_pact_stakes; _c public.daily_contracts; _chg uuid; _st text;
        _done_at timestamptz; _on_time boolean;
BEGIN
  SELECT * INTO _s FROM public.solo_pact_stakes WHERE id=_stake_id FOR UPDATE;
  IF NOT FOUND OR _s.state <> 'held' THEN RETURN; END IF;
  SELECT * INTO _c FROM public.daily_contracts WHERE id=_s.contract_id;
  _st := _c.status::text;

  -- a lowering counts only if it matured before the deadline
  IF _s.pending_effective_at IS NOT NULL AND _s.pending_effective_at <= now()
     AND _s.pending_effective_at <= _c.deadline_at THEN
    IF _s.amount > _s.pending_amount THEN
      INSERT INTO public.solo_stake_changes(stake_id,user_id,kind,coins)
      VALUES (_s.id,_s.user_id,'release',_s.amount-_s.pending_amount) RETURNING id INTO _chg;
      PERFORM public.acct_stake_ledger(_s.user_id, _s.amount-_s.pending_amount, 'solo_stake_release', _chg);
    END IF;
    UPDATE public.solo_pact_stakes SET amount=pending_amount, pending_amount=NULL, pending_effective_at=NULL,
      version=version+1, updated_at=now() WHERE id=_s.id RETURNING * INTO _s;
  END IF;

  IF _s.amount = 0 THEN
    IF _st IN ('verified','rewarded','missed','cancelled') OR now() > _c.deadline_at THEN
      UPDATE public.solo_pact_stakes SET state='released', outcome_reason='no_stake', settled_at=now(),
        version=version+1, updated_at=now() WHERE id=_s.id;
    END IF;
    RETURN;
  END IF;

  _done_at := public.acct_user_done_at(_c.id, _s.user_id);   -- user-side time only
  _on_time := _done_at IS NOT NULL AND _done_at <= _c.deadline_at AND NOT coalesce(_c.is_recovery,false);

  IF _st IN ('verified','rewarded') THEN
    IF _on_time THEN PERFORM public.acct_stake_pay_back(_s, 'on_time');
    ELSE PERFORM public.acct_stake_burn(_s, 'late'); END IF;
  ELSIF _st = 'missed' THEN
    IF _on_time THEN PERFORM public.acct_stake_pay_back(_s, 'done_on_time');
    ELSE PERFORM public.acct_stake_burn(_s, 'missed'); END IF;
  ELSIF now() > _c.deadline_at THEN
    IF _on_time AND _done_at + interval '12 hours' <= now() THEN
      PERFORM public.acct_stake_pay_back(_s, 'review_timeout');   -- slow partner never burns a stake
    ELSIF NOT _on_time THEN
      PERFORM public.acct_stake_burn(_s, CASE WHEN _st='cancelled' THEN 'cancelled_late' ELSE 'not_done' END);
    END IF;                                                       -- else: on-time work awaiting review, wait
  END IF;
END $$;

-- Trigger: stake-less contracts exit first; cancel = request lowering to 0 (24h)
CREATE OR REPLACE FUNCTION public.acct_contract_stake_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE _s public.solo_pact_stakes;
BEGIN
  SELECT * INTO _s FROM public.solo_pact_stakes WHERE contract_id = NEW.id AND state = 'held';
  IF NOT FOUND THEN RETURN NEW; END IF;
  IF NEW.status::text IS NOT DISTINCT FROM OLD.status::text THEN RETURN NEW; END IF;
  IF NEW.status::text = 'cancelled' THEN PERFORM public.acct_request_stake_lower(_s, 0); END IF;
  PERFORM public.acct_settle_stake(_s.id);
  RETURN NEW;
END $$;
CREATE TRIGGER trg_acct_contract_stake AFTER UPDATE OF status ON public.daily_contracts
  FOR EACH ROW EXECUTE FUNCTION public.acct_contract_stake_trigger();

-- Sweep: batches of 500, each row isolated; failures logged, others continue
CREATE OR REPLACE FUNCTION public.acct_sweep_solo_stakes()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE _r record; _n integer := 0; _state text; _msg text;
BEGIN
  FOR _r IN SELECT s.id FROM public.solo_pact_stakes s JOIN public.daily_contracts c ON c.id=s.contract_id
             WHERE s.state='held' AND (c.deadline_at < now() OR s.pending_effective_at <= now()
                   OR c.status::text IN ('verified','rewarded','missed','cancelled'))
             ORDER BY c.deadline_at LIMIT 500 LOOP
    BEGIN
      PERFORM public.acct_settle_stake(_r.id);
      _n := _n + 1;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS _state = RETURNED_SQLSTATE, _msg = MESSAGE_TEXT;
      INSERT INTO public.solo_stake_sweep_errors(stake_id, sqlstate, message) VALUES (_r.id, _state, left(_msg, 500));
    END;
  END LOOP;
  RETURN _n;
END $$;

-- ===== 6. User actions =====
CREATE OR REPLACE FUNCTION public.acct_set_solo_stake(_contract_id uuid, _amount integer, _expected_version integer)
RETURNS public.solo_pact_stakes LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE _uid uuid := auth.uid(); _s public.solo_pact_stakes; _c public.daily_contracts; _chg uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE='42501'; END IF;
  IF _amount NOT IN (0,10,25,50) THEN RAISE EXCEPTION 'Invalid stake' USING ERRCODE='22023'; END IF;
  SELECT * INTO _c FROM public.daily_contracts WHERE id=_contract_id AND user_id=_uid FOR UPDATE;
  IF NOT FOUND OR _c.status::text NOT IN ('draft','scheduled') OR _c.paused_at IS NOT NULL THEN
    RAISE EXCEPTION 'Stake locked' USING ERRCODE='42501'; END IF;
  IF _c.deadline_at IS NULL OR _c.deadline_at <= now() THEN
    RAISE EXCEPTION 'Set a future deadline first' USING ERRCODE='22023'; END IF;
  INSERT INTO public.solo_pact_stakes(contract_id,user_id) VALUES (_contract_id,_uid) ON CONFLICT (contract_id) DO NOTHING;
  SELECT * INTO _s FROM public.solo_pact_stakes WHERE contract_id=_contract_id FOR UPDATE;
  IF _s.version <> _expected_version THEN RAISE EXCEPTION 'Changed elsewhere, refresh' USING ERRCODE='40001'; END IF;
  IF _s.state <> 'held' THEN RAISE EXCEPTION 'Stake settled' USING ERRCODE='42501'; END IF;
  IF _amount > _s.amount THEN
    INSERT INTO public.solo_stake_changes(stake_id,user_id,kind,coins)
    VALUES (_s.id,_uid,CASE WHEN _s.amount=0 THEN 'hold' ELSE 'topup' END,_amount-_s.amount) RETURNING id INTO _chg;
    PERFORM public.acct_stake_ledger(_uid, -(_amount-_s.amount), 'solo_stake_hold', _chg);
    UPDATE public.solo_pact_stakes SET amount=_amount, pending_amount=NULL, pending_effective_at=NULL,
      version=version+1, updated_at=now() WHERE id=_s.id;
  ELSIF _amount < _s.amount THEN
    PERFORM public.acct_request_stake_lower(_s, _amount);
  END IF;
  SELECT * INTO _s FROM public.solo_pact_stakes WHERE id=_s.id;
  RETURN _s;
END $$;

CREATE OR REPLACE FUNCTION public.acct_pause_pact(_contract_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE _uid uuid := auth.uid(); _s public.solo_pact_stakes;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE='42501'; END IF;
  UPDATE public.daily_contracts SET paused_at = now()
   WHERE id=_contract_id AND user_id=_uid AND paused_at IS NULL AND status::text IN ('draft','scheduled');
  IF NOT FOUND THEN RAISE EXCEPTION 'Cannot pause' USING ERRCODE='42501'; END IF;
  SELECT * INTO _s FROM public.solo_pact_stakes WHERE contract_id=_contract_id AND state='held' FOR UPDATE;
  IF FOUND THEN PERFORM public.acct_request_stake_lower(_s, 0); END IF;
END $$;

CREATE OR REPLACE FUNCTION public.acct_settle_my_stakes()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE _r record; _n integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE='42501'; END IF;
  FOR _r IN SELECT id FROM public.solo_pact_stakes WHERE user_id=auth.uid() AND state='held' LOOP
    PERFORM public.acct_settle_stake(_r.id); _n := _n + 1;
  END LOOP;
  RETURN _n;
END $$;

-- Pact Creator write path: runs AS THE USER, so access rules and the contract guard apply unchanged
CREATE OR REPLACE FUNCTION public.acct_create_pact(
  _title text, _category text, _scheduled_at timestamptz, _timezone text, _planned_seconds integer,
  _rescue_seconds integer, _proof_method text, _difficulty smallint, _deadline_at timestamptz,
  _done_criteria text, _fallback_action text, _minimum_version text, _obstacles text,
  _evidence_required text, _is_solo boolean, _partner_visibility text, _reminder_pref text)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path TO '' AS $$
DECLARE _id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE='42501'; END IF;
  IF _deadline_at IS NOT NULL AND (_deadline_at <= _scheduled_at
     OR (_deadline_at AT TIME ZONE _timezone)::date > ((now() AT TIME ZONE _timezone)::date + 1)) THEN
    RAISE EXCEPTION 'Deadline must be today or tomorrow, after the start' USING ERRCODE='22023'; END IF;
  INSERT INTO public.daily_contracts(user_id, title, category, scheduled_at, timezone, local_day,
    planned_seconds, rescue_seconds, proof_method, difficulty, accountability_enabled, status,
    deadline_at, done_criteria, fallback_action, minimum_version, obstacles, evidence_required,
    is_solo, partner_visibility, reminder_pref)
  VALUES (auth.uid(), _title, _category, _scheduled_at, _timezone, (_scheduled_at AT TIME ZONE _timezone)::date,
    _planned_seconds, _rescue_seconds, _proof_method, _difficulty, NOT _is_solo, 'scheduled',
    _deadline_at, _done_criteria, _fallback_action, _minimum_version, _obstacles, _evidence_required,
    _is_solo, _partner_visibility, _reminder_pref)
  RETURNING id INTO _id;
  RETURN _id;
END $$;

-- ===== 7. Invites v2 =====
CREATE OR REPLACE FUNCTION public.create_accountability_invite_v2(_token_hash text, _role text DEFAULT 'reviewer')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE _uid uuid := auth.uid(); _id uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE='42501'; END IF;
  IF _token_hash IS NULL OR _token_hash !~ '^[0-9a-f]{64}$' OR _role NOT IN ('reviewer','supporter') THEN
    RAISE EXCEPTION 'Invite invalid or expired' USING ERRCODE='22023'; END IF;
  IF EXISTS (SELECT 1 FROM public.accountability_connections WHERE status='active' AND (user_id=_uid OR partner_id=_uid)) THEN
    RAISE EXCEPTION 'You already have a partner' USING ERRCODE='23505'; END IF;
  IF (SELECT count(*) FROM public.accountability_invites WHERE inviter_id=_uid AND created_at > now()-interval '1 day') >= 3 THEN
    RAISE EXCEPTION 'Invite limit reached for today' USING ERRCODE='54000'; END IF;
  PERFORM set_config('axen.contract_write','on',true);
  UPDATE public.accountability_invites SET revoked_at=now()
   WHERE inviter_id=_uid AND accepted_at IS NULL AND revoked_at IS NULL;   -- one live code at a time
  INSERT INTO public.accountability_invites(inviter_id, token_hash, expires_at, invitee_role)
  VALUES (_uid, _token_hash, now()+interval '48 hours', _role) RETURNING id INTO _id;
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.accept_accountability_invite_v2(_token_hash text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE _uid uuid := auth.uid(); _i public.accountability_invites; _cid uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE='42501'; END IF;
  IF (SELECT count(*) FROM public.invite_accept_attempts
       WHERE user_id=_uid AND NOT succeeded AND attempted_at > now()-interval '1 hour') >= 10 THEN
    RAISE EXCEPTION 'Too many attempts. Try again in an hour.' USING ERRCODE='54000'; END IF;
  SELECT * INTO _i FROM public.accountability_invites WHERE token_hash=_token_hash FOR UPDATE;
  IF NOT FOUND OR _i.accepted_at IS NOT NULL OR _i.revoked_at IS NOT NULL
     OR _i.expires_at <= now() OR _i.inviter_id = _uid THEN
    -- record the failure in an autonomous-safe way: the attempt row survives because we RETURN NULL instead of raising
    INSERT INTO public.invite_accept_attempts(user_id, succeeded) VALUES (_uid, false);
    RETURN NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM public.accountability_connections
             WHERE status='active' AND (user_id IN (_uid,_i.inviter_id) OR partner_id IN (_uid,_i.inviter_id))) THEN
    RAISE EXCEPTION 'You already have a partner' USING ERRCODE='23505'; END IF;
  PERFORM set_config('axen.contract_write','on',true);
  UPDATE public.accountability_invites SET accepted_by=_uid, accepted_at=now() WHERE id=_i.id;
  INSERT INTO public.accountability_connections(user_id, partner_id, invite_id, role_of_partner)
  VALUES (_i.inviter_id, _uid, _i.id, _i.invitee_role) RETURNING id INTO _cid;
  INSERT INTO public.accountability_events(connection_id, actor_id, recipient_id, kind)
  VALUES (_cid, _uid, _i.inviter_id, 'connected');
  INSERT INTO public.invite_accept_attempts(user_id, succeeded) VALUES (_uid, true);
  RETURN _cid;
END $$;
-- App treats a NULL result as "Invite invalid or expired".

-- ===== 8. Economy: stakes never inflate earnings or lower rank/badges =====
CREATE OR REPLACE FUNCTION public.leaderboard_scores(_period text)
RETURNS TABLE(user_id uuid, points integer, reached_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO public AS $$
  WITH win AS (
    SELECT CASE WHEN lower(coalesce(_period,'weekly')) = 'alltime'
                THEN '-infinity'::timestamptz ELSE date_trunc('week', now()) END AS since
  ),
  ct AS (
    SELECT c.user_id AS uid, sum(c.amount)::int AS pts, max(c.created_at) AS last_at
    FROM public.coin_transactions c, win w
    WHERE c.amount > 0 AND c.created_at >= w.since
      AND c.reason NOT IN ('solo_stake_hold','solo_stake_release','solo_stake_return')
    GROUP BY c.user_id
  ),
  se AS (
    SELECT s.user_id AS uid, sum(s.points)::int AS pts, max(s.occurred_at) AS last_at
    FROM public.score_events s, win w WHERE s.occurred_at >= w.since GROUP BY s.user_id
  ),
  u AS (SELECT * FROM ct UNION ALL SELECT * FROM se)
  SELECT u.uid, sum(u.pts)::int, max(u.last_at) FROM u GROUP BY u.uid;
$$;

CREATE OR REPLACE FUNCTION public.rank_verification_badges(_scope text, _period text)
RETURNS TABLE(user_id uuid, milestone integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
  WITH ranked AS (
    SELECT DISTINCT r.user_id FROM public.leaderboard_top(_scope, _period, 100, 0) AS r
    UNION SELECT auth.uid() WHERE auth.uid() IS NOT NULL
  ), eff AS (
    SELECT r.user_id, p.coins + public.acct_held_coins(r.user_id) AS c
    FROM ranked r JOIN public.profiles p ON p.id = r.user_id
  )
  SELECT e.user_id, CASE
    WHEN e.c >= 18250 THEN 365 WHEN e.c >= 14500 THEN 290 WHEN e.c >= 5000 THEN 100
    WHEN e.c >= 1050 THEN 21 WHEN e.c >= 350 THEN 7 ELSE NULL END
  FROM eff e WHERE auth.uid() IS NOT NULL AND e.c >= 350;
$$;

CREATE OR REPLACE FUNCTION public.get_verified_rank_coins(_scope text, _period text)
RETURNS TABLE(user_id uuid, coins_earned integer, highest_seal_tier text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501'; END IF;
 RETURN QUERY
 WITH tiers(days, threshold, tier) AS (
  VALUES (7,350,'bronze'::text),(21,1050,'silver'),(100,5000,'gold'),(290,14500,'amethyst'),(365,18250,'diamond')
 ), members AS (
  SELECT DISTINCT r.user_id FROM public.leaderboard_top(_scope,_period,100,0) r
 ), eff AS (
  SELECT p.id, (coalesce(p.coins,0) + public.acct_held_coins(p.id))::int AS c
  FROM members m JOIN public.profiles p ON p.id=m.user_id
 )
 SELECT e.id, e.c, (
  SELECT t.tier FROM tiers t
  WHERE e.c >= t.threshold OR EXISTS (
   SELECT 1 FROM public.unlock_rewards u WHERE u.user_id=e.id AND u.reward_key='milestone_seal_' || t.days)
  ORDER BY t.threshold DESC LIMIT 1)
 FROM eff e;
END $$;

CREATE OR REPLACE FUNCTION public.sync_milestone_seals(_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
 INSERT INTO public.unlock_rewards(user_id,reward_key,metadata)
 SELECT p.id, 'milestone_seal_' || m.days, jsonb_build_object('milestone',m.days,'threshold',m.coins)
 FROM public.profiles p CROSS JOIN (VALUES (7,350),(21,1050),(100,5000),(290,14500),(365,18250)) m(days,coins)
 WHERE p.id=_user_id AND p.coins + public.acct_held_coins(p.id) >= m.coins
 ON CONFLICT(user_id,reward_key) DO NOTHING;
END $$;

-- ===== 9. Permissions =====
REVOKE ALL ON FUNCTION
  public.acct_stake_ledger(uuid,integer,text,uuid),
  public.acct_held_coins(uuid),
  public.acct_user_done_at(uuid,uuid),
  public.acct_request_stake_lower(public.solo_pact_stakes,integer),
  public.acct_settle_stake(uuid),
  public.acct_stake_pay_back(public.solo_pact_stakes,text),
  public.acct_stake_burn(public.solo_pact_stakes,text),
  public.acct_contract_stake_trigger(),
  public.acct_sweep_solo_stakes()
FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION
  public.acct_set_solo_stake(uuid,integer,integer),
  public.acct_settle_my_stakes(),
  public.acct_pause_pact(uuid),
  public.acct_create_pact(text,text,timestamptz,text,integer,integer,text,smallint,timestamptz,text,text,text,text,text,boolean,text,text),
  public.create_accountability_invite_v2(text,text),
  public.accept_accountability_invite_v2(text)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION
  public.acct_set_solo_stake(uuid,integer,integer),
  public.acct_settle_my_stakes(),
  public.acct_pause_pact(uuid),
  public.acct_create_pact(text,text,timestamptz,text,integer,integer,text,smallint,timestamptz,text,text,text,text,text,boolean,text,text),
  public.create_accountability_invite_v2(text,text),
  public.accept_accountability_invite_v2(text)
TO authenticated;

-- ===== 10. Background sweep (every 5 minutes) =====
SELECT cron.schedule('acct-solo-stake-sweep', '*/5 * * * *', 'SELECT public.acct_sweep_solo_stakes()');

-- END OF BATCH A MIGRATION
```

Notes
- `acct_create_pact` is the 6th user action (you listed 5); it runs as the user, so it adds no new power. Say if you want it left out and the creator to write directly like the Home card does.
- Section 8 replaces 4 existing functions with the same signatures; only the stake exclusion / held-coin addition changes. Old bodies are kept in this plan's history for rollback.
- Bonus: 10 → 1, 25 → 2, 50 → 5 coins.

## App code changes in Batch A (after SQL)
- `dashboard.tsx` lifetime coins query: exclude `solo_stake_hold/release/return`.
- Invite screen calls v2 create/accept; NULL accept = "Invite invalid or expired"; text updated to 48 hours.
- Accountability screen rebuilt (dark default, Light switch), week strip, Solo pact, Pact Creator (one-time, today/tomorrow), stake picker. Supporter and Match me hidden.

## Tests after "run it"
Stake held once; returned once; bonus once; burned on miss; never below 0; 24h lowering lock; cancel rule; slow-partner case; completed-without-proof case; lifetime coins and rank unchanged by hold + return; existing Home contract flow works; anon and authenticated denied on internal functions; normal user cannot call `acct_stake_ledger`; invite expiry, no replay, attempt lockout; two-account partner flow (temporary accounts deleted afterwards).
