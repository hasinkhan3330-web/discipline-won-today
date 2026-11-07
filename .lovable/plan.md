# Accountability rebuild — Batch A SQL (waiting for "run it")

## Pre-check results (read-only)
- Old mutual stakes: 0 rows total, 0 unsettled. Old pacts: 0. Nothing to settle; old tables stay untouched and hidden.
- Coin ledger: `coin_transactions`; balances in `profiles.coins`, writable only inside server functions.
- Current invites expire after 24h; new invite function makes them 48h (old function left as-is, no longer called).

## Decisions folded in
Dark navy default + Light switch inside Accountability only; solo stake 0/10/25/50; Match me hidden; auto-proof read-only (Batch B); new pacts are normal contracts so Home card shows them both ways; presence via realtime channel (Batch B, no table needed now).

## Exact SQL (additive only: no DROP / TRUNCATE / DELETE)

```sql
-- 1. Pact fields on the existing contracts (single source of truth)
ALTER TABLE public.daily_contracts
  ADD COLUMN IF NOT EXISTS is_solo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS partner_visibility text NOT NULL DEFAULT 'private'
    CHECK (partner_visibility IN ('private','partner')),
  ADD COLUMN IF NOT EXISTS schedule_kind text NOT NULL DEFAULT 'once'
    CHECK (schedule_kind IN ('once','daily','weekly','custom')),
  ADD COLUMN IF NOT EXISTS schedule_days smallint[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS minimum_version text CHECK (char_length(minimum_version) <= 140),
  ADD COLUMN IF NOT EXISTS obstacles text CHECK (char_length(obstacles) <= 280),
  ADD COLUMN IF NOT EXISTS evidence_required text NOT NULL DEFAULT 'none'
    CHECK (evidence_required IN ('none','checkin','photo','document','session')),
  ADD COLUMN IF NOT EXISTS paused_at timestamptz;

-- 2. Partner roles
ALTER TABLE public.accountability_connections
  ADD COLUMN IF NOT EXISTS role_of_user text NOT NULL DEFAULT 'reviewer'
    CHECK (role_of_user IN ('reviewer','supporter')),
  ADD COLUMN IF NOT EXISTS role_of_partner text NOT NULL DEFAULT 'reviewer'
    CHECK (role_of_partner IN ('reviewer','supporter'));
ALTER TABLE public.accountability_invites
  ADD COLUMN IF NOT EXISTS invitee_role text NOT NULL DEFAULT 'reviewer'
    CHECK (invitee_role IN ('reviewer','supporter'));

-- 3. Solo coin stakes (own coins only)
CREATE TABLE public.solo_pact_stakes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL UNIQUE REFERENCES public.daily_contracts(id),
  user_id uuid NOT NULL,
  amount integer NOT NULL DEFAULT 0 CHECK (amount IN (0,10,25,50)),
  pending_amount integer CHECK (pending_amount IN (0,10,25,50)),
  pending_effective_at timestamptz,
  state text NOT NULL DEFAULT 'held' CHECK (state IN ('held','returned','burned','released')),
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.solo_stake_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stake_id uuid NOT NULL REFERENCES public.solo_pact_stakes(id),
  user_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('hold','topup','lower','return','bonus','burn','release')),
  coins integer NOT NULL CHECK (coins >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.solo_pact_stakes, public.solo_stake_changes TO authenticated;
GRANT ALL ON public.solo_pact_stakes, public.solo_stake_changes TO service_role;
ALTER TABLE public.solo_pact_stakes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solo_stake_changes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own stake read" ON public.solo_pact_stakes FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own stake change read" ON public.solo_stake_changes FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE INDEX solo_stake_pending_idx ON public.solo_pact_stakes (pending_effective_at) WHERE pending_effective_at IS NOT NULL;

-- Ledger: each stake change pays/charges exactly once
CREATE UNIQUE INDEX IF NOT EXISTS coin_solo_stake_once ON public.coin_transactions (user_id, reason, ref_id)
  WHERE reason IN ('solo_stake_hold','solo_stake_return','solo_stake_bonus','solo_stake_release');

-- Internal: move coins through ledger, never below 0
CREATE OR REPLACE FUNCTION public.acct_stake_ledger(_uid uuid, _delta integer, _reason text, _ref uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE _bal integer;
BEGIN
  PERFORM pg_catalog.set_config('axen.contract_write','on',true);
  SELECT coins INTO _bal FROM public.profiles WHERE id = _uid FOR UPDATE;
  IF _bal + _delta < 0 THEN RAISE EXCEPTION 'Not enough coins' USING ERRCODE='22003'; END IF;
  INSERT INTO public.coin_transactions(user_id, amount, reason, ref_id) VALUES (_uid, _delta, _reason, _ref);
  UPDATE public.profiles SET coins = coins + _delta WHERE id = _uid;
END $$;

-- User action: set stake (raise instant, lower/cancel after 24h), race-safe via version
CREATE OR REPLACE FUNCTION public.acct_set_solo_stake(_contract_id uuid, _amount integer, _expected_version integer)
RETURNS public.solo_pact_stakes LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE _uid uuid := auth.uid(); _s public.solo_pact_stakes; _c public.daily_contracts; _chg uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE='42501'; END IF;
  IF _amount NOT IN (0,10,25,50) THEN RAISE EXCEPTION 'Invalid stake' USING ERRCODE='22023'; END IF;
  SELECT * INTO _c FROM public.daily_contracts WHERE id=_contract_id AND user_id=_uid FOR UPDATE;
  IF NOT FOUND OR _c.status NOT IN ('draft','scheduled') THEN RAISE EXCEPTION 'Stake locked' USING ERRCODE='42501'; END IF;
  INSERT INTO public.solo_pact_stakes(contract_id,user_id,amount) VALUES (_contract_id,_uid,0)
    ON CONFLICT (contract_id) DO NOTHING;
  SELECT * INTO _s FROM public.solo_pact_stakes WHERE contract_id=_contract_id FOR UPDATE;
  IF _s.version <> _expected_version THEN RAISE EXCEPTION 'Changed elsewhere, refresh' USING ERRCODE='40001'; END IF;
  IF _s.state <> 'held' THEN RAISE EXCEPTION 'Stake settled' USING ERRCODE='42501'; END IF;
  IF _amount > _s.amount THEN
    INSERT INTO public.solo_stake_changes(stake_id,user_id,kind,coins)
      VALUES (_s.id,_uid,CASE WHEN _s.amount=0 THEN 'hold' ELSE 'topup' END,_amount-_s.amount) RETURNING id INTO _chg;
    PERFORM public.acct_stake_ledger(_uid, -(_amount-_s.amount), 'solo_stake_hold', _chg);
    UPDATE public.solo_pact_stakes SET amount=_amount, pending_amount=NULL, pending_effective_at=NULL,
      version=version+1, updated_at=now() WHERE id=_s.id RETURNING * INTO _s;
  ELSIF _amount < _s.amount THEN
    UPDATE public.solo_pact_stakes SET pending_amount=_amount, pending_effective_at=now()+interval '24 hours',
      version=version+1, updated_at=now() WHERE id=_s.id RETURNING * INTO _s;
  END IF;
  RETURN _s;
END $$;

-- Internal: apply due lowerings (called on app open and at settlement)
CREATE OR REPLACE FUNCTION public.acct_apply_stake_lowering(_stake_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE _s public.solo_pact_stakes; _chg uuid;
BEGIN
  SELECT * INTO _s FROM public.solo_pact_stakes WHERE id=_stake_id FOR UPDATE;
  IF _s.state<>'held' OR _s.pending_effective_at IS NULL OR _s.pending_effective_at > now() THEN RETURN; END IF;
  INSERT INTO public.solo_stake_changes(stake_id,user_id,kind,coins)
    VALUES (_s.id,_s.user_id,'release',_s.amount-_s.pending_amount) RETURNING id INTO _chg;
  PERFORM public.acct_stake_ledger(_s.user_id, _s.amount-_s.pending_amount, 'solo_stake_release', _chg);
  UPDATE public.solo_pact_stakes SET amount=_s.pending_amount, pending_amount=NULL, pending_effective_at=NULL,
    version=version+1, updated_at=now() WHERE id=_s.id;
END $$;

CREATE OR REPLACE FUNCTION public.acct_apply_my_stake_lowerings()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE _r record; _n integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE='42501'; END IF;
  FOR _r IN SELECT id FROM public.solo_pact_stakes WHERE user_id=auth.uid() AND state='held'
            AND pending_effective_at <= now() LOOP
    PERFORM public.acct_apply_stake_lowering(_r.id); _n := _n+1;
  END LOOP;
  RETURN _n;
END $$;

-- Settlement on contract outcome: on time = back + 10% bonus, missed = burned, cancelled = back
CREATE OR REPLACE FUNCTION public.acct_settle_solo_stake()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE _s public.solo_pact_stakes; _chg uuid; _bonus integer; _on_time boolean;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
  IF NEW.status NOT IN ('verified','rewarded','missed','cancelled') THEN RETURN NEW; END IF;
  SELECT * INTO _s FROM public.solo_pact_stakes WHERE contract_id=NEW.id FOR UPDATE;
  IF NOT FOUND OR _s.state<>'held' THEN RETURN NEW; END IF;
  PERFORM public.acct_apply_stake_lowering(_s.id);
  SELECT * INTO _s FROM public.solo_pact_stakes WHERE id=_s.id;
  IF _s.amount = 0 THEN
    UPDATE public.solo_pact_stakes SET state='returned', updated_at=now(), version=version+1 WHERE id=_s.id; RETURN NEW;
  END IF;
  _on_time := NEW.status IN ('verified','rewarded') AND NOT NEW.is_recovery
              AND coalesce(NEW.completed_at, now()) <= coalesce(NEW.deadline_at, NEW.expires_at, 'infinity');
  IF NEW.status = 'missed' OR (NEW.status IN ('verified','rewarded') AND NOT _on_time) THEN
    INSERT INTO public.solo_stake_changes(stake_id,user_id,kind,coins) VALUES (_s.id,_s.user_id,'burn',_s.amount);
    UPDATE public.solo_pact_stakes SET state='burned', updated_at=now(), version=version+1 WHERE id=_s.id;
  ELSE
    INSERT INTO public.solo_stake_changes(stake_id,user_id,kind,coins) VALUES (_s.id,_s.user_id,'return',_s.amount) RETURNING id INTO _chg;
    PERFORM public.acct_stake_ledger(_s.user_id, _s.amount, 'solo_stake_return', _chg);
    IF _on_time THEN
      _bonus := greatest(1, floor(_s.amount*0.1)::int);
      INSERT INTO public.solo_stake_changes(stake_id,user_id,kind,coins) VALUES (_s.id,_s.user_id,'bonus',_bonus) RETURNING id INTO _chg;
      PERFORM public.acct_stake_ledger(_s.user_id, _bonus, 'solo_stake_bonus', _chg);
    END IF;
    UPDATE public.solo_pact_stakes SET state='returned', updated_at=now(), version=version+1 WHERE id=_s.id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_acct_settle_solo_stake AFTER UPDATE OF status ON public.daily_contracts
  FOR EACH ROW EXECUTE FUNCTION public.acct_settle_solo_stake();

-- 4. Invites: 48h, single-use, role, old function left unchanged
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
  PERFORM pg_catalog.set_config('axen.contract_write','on',true);
  UPDATE public.accountability_invites SET revoked_at=now()
    WHERE inviter_id=_uid AND accepted_at IS NULL AND revoked_at IS NULL;   -- one live code at a time
  INSERT INTO public.accountability_invites(inviter_id, token_hash, expires_at, invitee_role)
    VALUES (_uid, _token_hash, now()+interval '48 hours', _role) RETURNING id INTO _id;
  RETURN _id;
END $$;

-- Role change (each side sets the role it grants its partner)
CREATE OR REPLACE FUNCTION public.acct_set_partner_role(_connection_id uuid, _role text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE='42501'; END IF;
  IF _role NOT IN ('reviewer','supporter') THEN RAISE EXCEPTION 'Invalid role' USING ERRCODE='22023'; END IF;
  PERFORM pg_catalog.set_config('axen.contract_write','on',true);
  UPDATE public.accountability_connections
     SET role_of_partner = CASE WHEN user_id=_uid THEN _role ELSE role_of_partner END,
         role_of_user    = CASE WHEN partner_id=_uid THEN _role ELSE role_of_user END
   WHERE id=_connection_id AND status='active' AND (user_id=_uid OR partner_id=_uid);
  IF NOT FOUND THEN RAISE EXCEPTION 'Not allowed' USING ERRCODE='42501'; END IF;
END $$;

-- 5. Permissions
REVOKE ALL ON FUNCTION public.acct_stake_ledger(uuid,integer,text,uuid),
  public.acct_apply_stake_lowering(uuid), public.acct_settle_solo_stake() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.acct_set_solo_stake(uuid,integer,integer), public.acct_apply_my_stake_lowerings(),
  public.create_accountability_invite_v2(text,text), public.acct_set_partner_role(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.acct_set_solo_stake(uuid,integer,integer), public.acct_apply_my_stake_lowerings(),
  public.create_accountability_invite_v2(text,text), public.acct_set_partner_role(uuid,text) TO authenticated;
```

## Notes to confirm
- Bonus rounds down with minimum 1 coin (10 -> 1, 25 -> 2, 50 -> 5).
- A late completion or Comeback-recovered pact counts as not on time, so the stake burns (rewards for the pact itself unchanged).
- Cancelling a pact returns the stake (after any pending 24h lowering is applied).
- Accept-invite still uses the existing function; Batch A UI copies the invite role onto the connection via `acct_set_partner_role`.

## After "run it"
Apply, verify tables/RLS/grants, then build Batch A (design system with dark default + Light switch, Accountability Home, week strip, invites and roles, Solo pact, Pact Creator writing to existing contracts, stake), tests, screenshots, then stop.
