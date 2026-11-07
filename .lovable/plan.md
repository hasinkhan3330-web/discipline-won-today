# Batch A — Step 1 results + revised SQL (NOT run; waiting for "run it")

## Step 1: read-only check results

**a) daily_contracts**
- `status` is an enum `contract_status` (draft, scheduled, active, proof_pending, verified, rewarded, missed, cancelled). There is no `expired` value.
- In use today: rewarded 3, missed 5, cancelled 1, scheduled 6.
- `is_recovery boolean NOT NULL`, `completed_at timestamptz` null, `deadline_at timestamptz` null, `expires_at timestamptz` null — all exist.

**b) coin_transactions**
- Columns: id uuid NN (default gen_random_uuid), user_id uuid NN, amount int NN, reason text NN, ref_id uuid, created_at timestamptz NN (now()), reward_source, reward_local_date, reward_key, reward_timezone (all nullable).
- No CHECK or enum on `reason` (free text). Only PK + FK to users.
- Unique indexes: `coin_completion_daily_unique`, `coin_completion_source_unique`, `coin_pact_once` (pact_hold/refund/payout).
- No triggers on coin_transactions. Triggers on profiles: `guard_profile_economy_trg`, `guard_reward_timezone`, `sync_profile_milestone_seals` (reacts to coins), `update_profiles_updated_at`, `wake_timezone_changed`. None of them adds or removes coins; the guard silently reverts coin changes unless the setting below is on.

**c) Exact guard setting**
- `guard_profile_economy` checks only `app.economy_write = 'on'`.
- `axen_award_completion_coins` and `award_contract` set both `app.economy_write` and `axen.contract_write` before touching coins. Revised SQL copies both. (My previous draft set only `axen.contract_write`, which would have been silently reverted — fixed.)

**d) What marks a contract missed**
- Only `end_contract_session`: an active session ending early sets `missed`. Nothing marks a never-started contract; 6 contracts are still `scheduled` past their day. No cron jobs exist right now.
- So stakes need their own sweep (included below). The sweep settles the stake only; it never changes a contract's status, so the Home card behaves exactly as today.

**e) Current accept function**: `accept_accountability_invite(_token_hash)` — locks invite, rejects accepted/revoked/expired/self, rejects if either side already has a partner, marks accepted, inserts connection, logs `connected`. Left untouched; v2 below copies it plus the role.

## Changes vs. last draft
1. Status compared as text; contracts without a stake return immediately.
2. On time = user's first proof **submission** time <= deadline. Never reviewer time.
3. Cancel or pause a staked pact = request lowering to 0 with the 24h delay. Refund only if it matures before the deadline; otherwise the outcome decides.
4. Sweep included (every 5 min + on app open). Slow partner: proof sent on time and still unreviewed 12h later = stake back + bonus.
5. Role copied server-side by `accept_accountability_invite_v2`. Client role step removed.
6. Supporter hidden in Batch A (everyone is Reviewer); enforcement comes with Batch B review work.
7. One-time pacts only (today/tomorrow). Daily/Weekly columns removed from this batch.
8. `coalesce(is_recovery,false)`, raise if profile missing, stake id as ref_id for return and bonus.
9. The migration tool runs the whole file as one transaction (any error rolls everything back).
- A stake requires the pact to have a deadline.

## Revised SQL

```sql
-- 1. Pact fields on existing contracts (single source of truth)
ALTER TABLE public.daily_contracts
  ADD COLUMN IF NOT EXISTS is_solo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS partner_visibility text NOT NULL DEFAULT 'private'
    CHECK (partner_visibility IN ('private','partner')),
  ADD COLUMN IF NOT EXISTS minimum_version text CHECK (char_length(minimum_version) <= 140),
  ADD COLUMN IF NOT EXISTS obstacles text CHECK (char_length(obstacles) <= 280),
  ADD COLUMN IF NOT EXISTS evidence_required text NOT NULL DEFAULT 'none'
    CHECK (evidence_required IN ('none','checkin','photo','document','session')),
  ADD COLUMN IF NOT EXISTS paused_at timestamptz;

-- 2. Roles (stored now, Supporter not offered until Batch B)
ALTER TABLE public.accountability_connections
  ADD COLUMN IF NOT EXISTS role_of_user text NOT NULL DEFAULT 'reviewer'
    CHECK (role_of_user IN ('reviewer','supporter')),
  ADD COLUMN IF NOT EXISTS role_of_partner text NOT NULL DEFAULT 'reviewer'
    CHECK (role_of_partner IN ('reviewer','supporter'));
ALTER TABLE public.accountability_invites
  ADD COLUMN IF NOT EXISTS invitee_role text NOT NULL DEFAULT 'reviewer'
    CHECK (invitee_role IN ('reviewer','supporter'));

-- 3. Solo stakes
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
GRANT SELECT ON public.solo_pact_stakes, public.solo_stake_changes TO authenticated;
GRANT ALL ON public.solo_pact_stakes, public.solo_stake_changes TO service_role;
ALTER TABLE public.solo_pact_stakes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solo_stake_changes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own stake read" ON public.solo_pact_stakes FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own stake change read" ON public.solo_stake_changes FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE INDEX solo_stake_held_idx ON public.solo_pact_stakes (contract_id) WHERE state = 'held';

-- Ledger once-only: hold/release keyed by change id; return/bonus keyed by stake id
CREATE UNIQUE INDEX IF NOT EXISTS coin_solo_stake_once ON public.coin_transactions (user_id, reason, ref_id)
  WHERE reason IN ('solo_stake_hold','solo_stake_release','solo_stake_return','solo_stake_bonus');

-- Internal: one coin move, same guards as existing award code, never below 0
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

-- Internal: request lowering (24h delay); never shortens an earlier request
CREATE OR REPLACE FUNCTION public.acct_request_stake_lower(_s public.solo_pact_stakes, _amount integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  IF _s.state <> 'held' OR _amount >= _s.amount THEN RETURN; END IF;
  UPDATE public.solo_pact_stakes
     SET pending_amount = _amount,
         pending_effective_at = coalesce(pending_effective_at, now() + interval '24 hours'),
         version = version + 1, updated_at = now()
   WHERE id = _s.id;
  INSERT INTO public.solo_stake_changes(stake_id,user_id,kind,coins) VALUES (_s.id,_s.user_id,'lower_requested',_s.amount-_amount);
END $$;

-- User action: set stake. Raise = instant; lower = 24h. Race-safe via version.
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

-- Internal: settle one stake (idempotent; safe to call any number of times)
CREATE OR REPLACE FUNCTION public.acct_settle_stake(_stake_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE _s public.solo_pact_stakes; _c public.daily_contracts; _chg uuid; _st text;
        _proof_at timestamptz; _on_time boolean; _bonus integer;
BEGIN
  SELECT * INTO _s FROM public.solo_pact_stakes WHERE id=_stake_id FOR UPDATE;
  IF NOT FOUND OR _s.state <> 'held' THEN RETURN; END IF;
  SELECT * INTO _c FROM public.daily_contracts WHERE id=_s.contract_id;
  _st := _c.status::text;

  -- matured lowering applies only if it matured before the deadline
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

  SELECT min(created_at) INTO _proof_at FROM public.proof_submissions
   WHERE contract_id=_c.id AND user_id=_s.user_id;
  _on_time := _proof_at IS NOT NULL AND _proof_at <= _c.deadline_at AND NOT coalesce(_c.is_recovery,false);

  IF _st IN ('verified','rewarded') THEN
    IF _on_time THEN
      PERFORM public.acct_stake_pay_back(_s, 'on_time');
    ELSE
      PERFORM public.acct_stake_burn(_s, 'late');
    END IF;
  ELSIF _st = 'missed' THEN
    PERFORM public.acct_stake_burn(_s, 'missed');
  ELSIF now() > _c.deadline_at THEN
    IF _on_time AND _proof_at + interval '12 hours' <= now() THEN
      PERFORM public.acct_stake_pay_back(_s, 'review_timeout');      -- slow partner never burns a stake
    ELSIF NOT _on_time THEN
      PERFORM public.acct_stake_burn(_s, CASE WHEN _st='cancelled' THEN 'cancelled_late' ELSE 'no_proof' END);
    END IF;                                                           -- else: on-time proof awaiting review, wait
  END IF;
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

-- Trigger: outcome changes and cancel. Contracts without a stake exit first.
CREATE OR REPLACE FUNCTION public.acct_contract_stake_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE _s public.solo_pact_stakes;
BEGIN
  SELECT * INTO _s FROM public.solo_pact_stakes WHERE contract_id = NEW.id AND state = 'held';
  IF NOT FOUND THEN RETURN NEW; END IF;
  IF NEW.status::text IS NOT DISTINCT FROM OLD.status::text THEN RETURN NEW; END IF;
  IF NEW.status::text = 'cancelled' THEN
    PERFORM public.acct_request_stake_lower(_s, 0);
  END IF;
  PERFORM public.acct_settle_stake(_s.id);
  RETURN NEW;
END $$;
CREATE TRIGGER trg_acct_contract_stake AFTER UPDATE OF status ON public.daily_contracts
  FOR EACH ROW EXECUTE FUNCTION public.acct_contract_stake_trigger();

-- User action: pause a pact = request stake lowering to 0
CREATE OR REPLACE FUNCTION public.acct_pause_pact(_contract_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE _uid uuid := auth.uid(); _s public.solo_pact_stakes;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE='42501'; END IF;
  PERFORM set_config('axen.contract_write','on',true);
  UPDATE public.daily_contracts SET paused_at = now()
   WHERE id=_contract_id AND user_id=_uid AND paused_at IS NULL AND status::text IN ('draft','scheduled');
  IF NOT FOUND THEN RAISE EXCEPTION 'Cannot pause' USING ERRCODE='42501'; END IF;
  SELECT * INTO _s FROM public.solo_pact_stakes WHERE contract_id=_contract_id AND state='held' FOR UPDATE;
  IF FOUND THEN PERFORM public.acct_request_stake_lower(_s, 0); END IF;
END $$;

-- Sweep: settles due stakes in batches; also callable on app open for own stakes
CREATE OR REPLACE FUNCTION public.acct_sweep_solo_stakes()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE _r record; _n integer := 0;
BEGIN
  FOR _r IN SELECT s.id FROM public.solo_pact_stakes s JOIN public.daily_contracts c ON c.id=s.contract_id
             WHERE s.state='held' AND (c.deadline_at < now() OR s.pending_effective_at <= now()
                   OR c.status::text IN ('verified','rewarded','missed','cancelled'))
             ORDER BY c.deadline_at LIMIT 500 FOR UPDATE OF s SKIP LOCKED LOOP
    PERFORM public.acct_settle_stake(_r.id); _n := _n + 1;
  END LOOP;
  RETURN _n;
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

SELECT cron.schedule('acct-solo-stake-sweep', '*/5 * * * *', 'SELECT public.acct_sweep_solo_stakes()');

-- 4. Invites v2: 48h, one live code, role stored; accept v2 copies role server-side
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
   WHERE inviter_id=_uid AND accepted_at IS NULL AND revoked_at IS NULL;
  INSERT INTO public.accountability_invites(inviter_id, token_hash, expires_at, invitee_role)
  VALUES (_uid, _token_hash, now()+interval '48 hours', _role) RETURNING id INTO _id;
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.accept_accountability_invite_v2(_token_hash text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE _uid uuid := auth.uid(); _i public.accountability_invites; _cid uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE='42501'; END IF;
  SELECT * INTO _i FROM public.accountability_invites WHERE token_hash=_token_hash FOR UPDATE;
  IF NOT FOUND OR _i.accepted_at IS NOT NULL OR _i.revoked_at IS NOT NULL
     OR _i.expires_at <= now() OR _i.inviter_id = _uid THEN
    RAISE EXCEPTION 'Invite invalid or expired' USING ERRCODE='22023'; END IF;
  IF EXISTS (SELECT 1 FROM public.accountability_connections
             WHERE status='active' AND (user_id IN (_uid,_i.inviter_id) OR partner_id IN (_uid,_i.inviter_id))) THEN
    RAISE EXCEPTION 'You already have a partner' USING ERRCODE='23505'; END IF;
  PERFORM set_config('axen.contract_write','on',true);
  UPDATE public.accountability_invites SET accepted_by=_uid, accepted_at=now() WHERE id=_i.id;
  INSERT INTO public.accountability_connections(user_id, partner_id, invite_id, role_of_partner)
  VALUES (_i.inviter_id, _uid, _i.id, _i.invitee_role) RETURNING id INTO _cid;
  INSERT INTO public.accountability_events(connection_id, actor_id, recipient_id, kind)
  VALUES (_cid, _uid, _i.inviter_id, 'connected');
  RETURN _cid;
END $$;

-- 5. Permissions
REVOKE ALL ON FUNCTION public.acct_stake_ledger(uuid,integer,text,uuid),
  public.acct_request_stake_lower(public.solo_pact_stakes,integer),
  public.acct_settle_stake(uuid), public.acct_stake_pay_back(public.solo_pact_stakes,text),
  public.acct_stake_burn(public.solo_pact_stakes,text), public.acct_contract_stake_trigger(),
  public.acct_sweep_solo_stakes() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.acct_set_solo_stake(uuid,integer,integer), public.acct_pause_pact(uuid),
  public.acct_settle_my_stakes(), public.create_accountability_invite_v2(text,text),
  public.accept_accountability_invite_v2(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.acct_set_solo_stake(uuid,integer,integer), public.acct_pause_pact(uuid),
  public.acct_settle_my_stakes(), public.create_accountability_invite_v2(text,text),
  public.accept_accountability_invite_v2(text) TO authenticated;
```

## Step 3: before "run it"
- Please take a database export first: More → Database → Manage → Settings → Export data. (Daily automatic backups also exist under Manage → Backups; check the newest time there.)
- After "run it": apply, verify tables/RLS/grants/cron, then run tests for: held once, returned once, bonus once, burned on miss, never below 0, 24h lowering lock, cancel rule, slow-partner case, existing Home contract flow, and two-account partner flows (temporary accounts, deleted afterwards).

## Open risk
- `guard_contract_fields` may reset new contract columns when the app inserts a pact directly; I will check its body before building the creator and route writes through a server function if needed.
