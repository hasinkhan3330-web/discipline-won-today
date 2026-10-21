# Phase 2: Accountability server rules (for your approval)

Phase 1 is applied and checked: 7 new tables, 3 optional contract fields and the once-only coin rule. Signed-out users have no access. Signed-in users can only read their own or their partner's rows.

This step adds the protected actions that do all the writing. Nothing on screen changes until Phase 3. Contract, Zen, Coach, Rank, Stats, Home, You, 4AM, the 15-minute Comeback and all existing rewards stay as they are.

## How a pact works
```text
pending --partner accepts same terms--> escrowed (both stakes held)
escrowed --proof sent--> awaiting_review --approve--> approved side
                                        --reject + reason--> disputed (24h)
deadline passes with no proof --> missed side
both sides final, or any timeout --> settled (coins moved once)
before deadline, both ask to cancel --> cancelled (both refunded)
```
"active" is passed through instantly on acceptance and never stored, because acceptance and the hold happen together.

## Settlement matrix
| Situation | Coins |
|---|---|
| Both approved | Both refunded |
| One approved, other missed | Winner refunded + gets loser's stake |
| Both missed | Both lose stake, no transfer |
| Both cancel before deadline | Both refunded |
| Partner doesn't review in 24h | Auto-approved, both refunded, no transfer |
| Rejected, dispute not resolved in 24h | Both refunded |
| Partner ends the connection mid-pact | Both refunded |

A pact is refused if either person doesn't have the coins. No balance goes below zero, and no person can be refunded or paid twice, even if two requests arrive at the same moment.

## Decisions you need to confirm (your brief didn't cover these)
1. **Grace period length: 15 minutes.** It applies only if the proof upload started before the deadline.
2. **Review timeout:** your rule says "auto-approve refunds both without transfers". I applied it literally, so it refunds both **even if the other side missed**.
3. **Dispute:** only the reviewer can resolve it by withdrawing the rejection, which then counts as approved. Otherwise, after 24 hours both are refunded. So a rejection alone never makes the rejector win coins.
4. **Partner ends the connection mid-pact:** both refunded (a new "connection ended" outcome).
5. **Pending invite:** expires at the deadline if not accepted. Nothing is held while pending.
6. **Quiet hours for the 2-hour warning: 22:00 to 07:00 in your time zone.** A warning that would land in quiet hours moves to 07:00. If that is less than 30 minutes before the deadline, it is skipped.
7. **Warnings when the app is closed:** the existing background push is still switched off. So warnings appear when you open the app, plus a phone notification the app schedules ahead of time (Phase 3). They are not guaranteed while the app is closed.
8. **The 5–10 minute restart** gives no coins. The 15-minute Comeback keeps its existing reward. The missed commitment always stays missed.
9. **Work Together:** a partner who doesn't join within 10 minutes is marked no-show. Anyone silent for 2 minutes during a session ends it as interrupted. The app checks in every 30 seconds.
10. **Message limit:** 30 messages per hour, 280 characters each. Muted partners' messages are still saved but don't pop up.
11. The old template and Emergency nudge sending stays switched on behind the scenes, so old history and the daily check-in keep working. Phase 3 removes the buttons only.

## Exact SQL

```sql
-- A. Extra pact tracking columns (new table, all optional or defaulted)
ALTER TABLE public.pact_stakes
  ADD COLUMN deadline_at timestamptz,
  ADD COLUMN grace_minutes integer NOT NULL DEFAULT 15 CHECK (grace_minutes BETWEEN 0 AND 60),
  ADD COLUMN creator_result text NOT NULL DEFAULT 'pending' CHECK (creator_result IN ('pending','submitted','approved','rejected','missed')),
  ADD COLUMN partner_result text NOT NULL DEFAULT 'pending' CHECK (partner_result IN ('pending','submitted','approved','rejected','missed')),
  ADD COLUMN creator_proof_id uuid REFERENCES public.proof_submissions(id),
  ADD COLUMN partner_proof_id uuid REFERENCES public.proof_submissions(id),
  ADD COLUMN creator_upload_started_at timestamptz,
  ADD COLUMN partner_upload_started_at timestamptz,
  ADD COLUMN creator_review_due_at timestamptz,
  ADD COLUMN partner_review_due_at timestamptz,
  ADD COLUMN review_timed_out boolean NOT NULL DEFAULT false,
  ADD COLUMN dispute_timed_out boolean NOT NULL DEFAULT false;
ALTER TABLE public.pact_stakes DROP CONSTRAINT pact_stakes_outcome_check;
ALTER TABLE public.pact_stakes ADD CONSTRAINT pact_stakes_outcome_check CHECK (outcome IS NULL OR outcome IN
  ('both_approved','creator_won','partner_won','both_missed','mutual_cancel','review_timeout','dispute_timeout','dispute_resolved','connection_ended'));

-- B. Allow new notification kinds on the existing partner event feed (superset; old rows still valid)
ALTER TABLE public.accountability_events DROP CONSTRAINT accountability_events_kind_check;
ALTER TABLE public.accountability_events ADD CONSTRAINT accountability_events_kind_check CHECK (kind = ANY (ARRAY[
  'nudge','cheer','contract_verified','contract_missed','connected','revoked','emergency','checkin',
  'review_requested','review_confirmed','review_asked','review_disputed','review_resubmitted','review_resolved',
  'pact_invite','pact_accepted','pact_review_needed','pact_approved','pact_rejected','pact_dispute_withdrawn',
  'pact_cancel_requested','pact_cancelled','pact_settled','cofocus_invite','cofocus_started']));

ALTER PUBLICATION supabase_realtime ADD TABLE public.cofocus_sessions;

-- C. Internal helpers (no one can call these directly)
CREATE OR REPLACE FUNCTION public.acct_coin_move(_uid uuid, _amount integer, _reason text, _ref uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _n integer;
BEGIN
  IF _reason NOT IN ('pact_hold','pact_refund','pact_payout') THEN RAISE EXCEPTION 'invalid reason'; END IF;
  INSERT INTO public.coin_transactions(user_id, amount, reason, ref_id) VALUES (_uid, _amount, _reason, _ref)
  ON CONFLICT (user_id, reason, ref_id) WHERE reason IN ('pact_hold','pact_refund','pact_payout') DO NOTHING;
  GET DIAGNOSTICS _n = ROW_COUNT;
  IF _n = 0 THEN RETURN false; END IF;               -- already moved: exactly once
  PERFORM pg_catalog.set_config('app.economy_write', 'on', true);
  UPDATE public.profiles SET coins = coins + _amount WHERE id = _uid;
  PERFORM pg_catalog.set_config('app.economy_write', 'off', true);
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.acct_notify(_conn uuid, _actor uuid, _to uuid, _kind text, _msg text, _contract uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF _actor = _to THEN RETURN; END IF;
  PERFORM pg_catalog.set_config('axen.contract_write', 'on', true);
  INSERT INTO public.accountability_events(connection_id, actor_id, recipient_id, kind, message, contract_id)
  VALUES (_conn, _actor, _to, _kind, left(_msg, 140), _contract);
END $$;

CREATE OR REPLACE FUNCTION public.acct_refund_both(_p public.pact_stakes)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN  -- fixed id order avoids deadlocks between concurrent pacts
  PERFORM public.acct_coin_move(LEAST(_p.creator_id, _p.partner_id), _p.stake_coins, 'pact_refund', _p.id);
  PERFORM public.acct_coin_move(GREATEST(_p.creator_id, _p.partner_id), _p.stake_coins, 'pact_refund', _p.id);
END $$;

-- D. The single state engine: every action and the background job go through this
CREATE OR REPLACE FUNCTION public.acct_pact_advance(_pact uuid)
RETURNS public.pact_stakes LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p public.pact_stakes; _grace timestamptz; _out text; _n integer; _win uuid;
BEGIN
  SELECT * INTO _p FROM public.pact_stakes WHERE id = _pact FOR UPDATE;
  IF NOT FOUND OR _p.state IN ('settled','cancelled') THEN RETURN _p; END IF;

  IF _p.state = 'pending' THEN
    IF now() >= _p.deadline_at THEN
      UPDATE public.pact_stakes SET state = 'cancelled', updated_at = now() WHERE id = _p.id RETURNING * INTO _p;
    END IF;
    RETURN _p;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.accountability_connections c WHERE c.id = _p.connection_id AND c.status = 'active') THEN
    PERFORM public.acct_refund_both(_p);
    UPDATE public.pact_stakes SET state = 'settled', outcome = 'connection_ended', settled_at = now(), updated_at = now()
     WHERE id = _p.id RETURNING * INTO _p;
    RETURN _p;
  END IF;

  _grace := _p.deadline_at + pg_catalog.make_interval(mins => _p.grace_minutes);
  IF _p.creator_result = 'pending' AND now() >= _p.deadline_at
     AND (now() >= _grace OR _p.creator_upload_started_at IS NULL OR _p.creator_upload_started_at >= _p.deadline_at) THEN
    _p.creator_result := 'missed';
  END IF;
  IF _p.partner_result = 'pending' AND now() >= _p.deadline_at
     AND (now() >= _grace OR _p.partner_upload_started_at IS NULL OR _p.partner_upload_started_at >= _p.deadline_at) THEN
    _p.partner_result := 'missed';
  END IF;

  IF _p.creator_result = 'submitted' AND now() > _p.creator_review_due_at THEN
    _p.creator_result := 'approved'; _p.review_timed_out := true;
    INSERT INTO public.trust_events(user_id, kind, ref_id, kept) VALUES (_p.partner_id, 'review', _p.creator_proof_id, false) ON CONFLICT DO NOTHING;
  END IF;
  IF _p.partner_result = 'submitted' AND now() > _p.partner_review_due_at THEN
    _p.partner_result := 'approved'; _p.review_timed_out := true;
    INSERT INTO public.trust_events(user_id, kind, ref_id, kept) VALUES (_p.creator_id, 'review', _p.partner_proof_id, false) ON CONFLICT DO NOTHING;
  END IF;

  UPDATE public.pact_disputes SET resolution = 'timeout_refund', resolved_at = now()
   WHERE pact_id = _p.id AND resolution IS NULL AND closes_at <= now();
  GET DIAGNOSTICS _n = ROW_COUNT;
  IF _n > 0 THEN _p.dispute_timed_out := true; END IF;

  _p.state := CASE
    WHEN EXISTS (SELECT 1 FROM public.pact_disputes d WHERE d.pact_id = _p.id AND d.resolution IS NULL) THEN 'disputed'
    WHEN 'submitted' IN (_p.creator_result, _p.partner_result) THEN 'awaiting_review'
    WHEN 'pending' IN (_p.creator_result, _p.partner_result) THEN 'escrowed'
    ELSE 'approved' END;

  IF _p.dispute_timed_out OR _p.review_timed_out
     OR (_p.creator_result IN ('approved','missed') AND _p.partner_result IN ('approved','missed')) THEN
    _out := CASE
      WHEN _p.dispute_timed_out THEN 'dispute_timeout'
      WHEN _p.review_timed_out THEN 'review_timeout'
      WHEN _p.creator_result = 'approved' AND _p.partner_result = 'approved' THEN 'both_approved'
      WHEN _p.creator_result = 'approved' THEN 'creator_won'
      WHEN _p.partner_result = 'approved' THEN 'partner_won'
      ELSE 'both_missed' END;
    IF _out IN ('dispute_timeout','review_timeout','both_approved') THEN
      PERFORM public.acct_refund_both(_p);
    ELSIF _out IN ('creator_won','partner_won') THEN
      _win := CASE WHEN _out = 'creator_won' THEN _p.creator_id ELSE _p.partner_id END;
      PERFORM public.acct_coin_move(_win, _p.stake_coins, 'pact_refund', _p.id);
      PERFORM public.acct_coin_move(_win, _p.stake_coins, 'pact_payout', _p.id);
    END IF;  -- both_missed: stakes stay forfeited, nothing moves
    IF _p.creator_result <> 'pending' THEN
      INSERT INTO public.trust_events(user_id, kind, ref_id, kept)
      VALUES (_p.creator_id, 'commitment', _p.creator_contract_id, _p.creator_result <> 'missed') ON CONFLICT DO NOTHING;
    END IF;
    IF _p.partner_result <> 'pending' THEN
      INSERT INTO public.trust_events(user_id, kind, ref_id, kept)
      VALUES (_p.partner_id, 'commitment', _p.partner_contract_id, _p.partner_result <> 'missed') ON CONFLICT DO NOTHING;
    END IF;
    _p.state := 'settled'; _p.outcome := _out; _p.settled_at := now();
    PERFORM public.acct_notify(_p.connection_id, _p.creator_id, _p.partner_id, 'pact_settled', 'Your pact is settled.', _p.partner_contract_id);
    PERFORM public.acct_notify(_p.connection_id, _p.partner_id, _p.creator_id, 'pact_settled', 'Your pact is settled.', _p.creator_contract_id);
  END IF;

  UPDATE public.pact_stakes SET state = _p.state, outcome = _p.outcome, settled_at = _p.settled_at,
    creator_result = _p.creator_result, partner_result = _p.partner_result,
    review_timed_out = _p.review_timed_out, dispute_timed_out = _p.dispute_timed_out, updated_at = now()
   WHERE id = _p.id RETURNING * INTO _p;
  RETURN _p;
END $$;

-- E. Pact actions (signed-in parties only)
CREATE OR REPLACE FUNCTION public.pact_create(_contract uuid, _stake integer, _deadline timestamptz)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _uid uuid := auth.uid(); _c public.accountability_connections; _partner uuid; _id uuid; _coins integer;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501'; END IF;
  IF _stake IS NULL OR _stake NOT BETWEEN 10 AND 500 THEN RAISE EXCEPTION 'stake must be 10-500 coins' USING ERRCODE = '22023'; END IF;
  IF _deadline IS NULL OR _deadline < now() + interval '5 minutes' THEN RAISE EXCEPTION 'deadline too soon' USING ERRCODE = '22023'; END IF;
  SELECT * INTO _c FROM public.accountability_connections WHERE status = 'active' AND (user_id = _uid OR partner_id = _uid) LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'no active partner' USING ERRCODE = '42501'; END IF;
  _partner := CASE WHEN _c.user_id = _uid THEN _c.partner_id ELSE _c.user_id END;
  IF NOT EXISTS (SELECT 1 FROM public.daily_contracts WHERE id = _contract AND user_id = _uid AND status IN ('draft','scheduled','active')) THEN
    RAISE EXCEPTION 'contract not found' USING ERRCODE = '42501'; END IF;
  SELECT coins INTO _coins FROM public.profiles WHERE id = _uid;
  IF coalesce(_coins, 0) < _stake THEN RAISE EXCEPTION 'not enough coins' USING ERRCODE = '22023'; END IF;
  INSERT INTO public.pact_stakes(connection_id, creator_id, partner_id, creator_contract_id, stake_coins, deadline_at, creator_accepted_at)
  VALUES (_c.id, _uid, _partner, _contract, _stake, _deadline, now()) RETURNING id INTO _id;
  PERFORM public.acct_notify(_c.id, _uid, _partner, 'pact_invite', 'Your partner invited you to a pact.', NULL);
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.pact_accept(_pact uuid, _contract uuid, _terms_version integer)
RETURNS public.pact_stakes LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _uid uuid := auth.uid(); _p public.pact_stakes; _low integer; _mine integer; _theirs integer;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501'; END IF;
  _p := public.acct_pact_advance(_pact);
  IF _p.id IS NULL OR _p.partner_id <> _uid THEN RAISE EXCEPTION 'not found' USING ERRCODE = '42501'; END IF;
  IF _p.state <> 'pending' THEN
    IF _p.partner_accepted_at IS NOT NULL THEN RETURN _p; END IF;  -- idempotent repeat
    RAISE EXCEPTION 'pact no longer open' USING ERRCODE = '22023'; END IF;
  IF _terms_version IS DISTINCT FROM _p.terms_version THEN RAISE EXCEPTION 'terms changed' USING ERRCODE = '22023'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.daily_contracts WHERE id = _contract AND user_id = _uid AND status IN ('draft','scheduled','active')) THEN
    RAISE EXCEPTION 'contract not found' USING ERRCODE = '42501'; END IF;
  PERFORM 1 FROM public.profiles WHERE id IN (_p.creator_id, _p.partner_id) ORDER BY id FOR UPDATE;
  SELECT coins INTO _mine FROM public.profiles WHERE id = _uid;
  SELECT coins INTO _theirs FROM public.profiles WHERE id = _p.creator_id;
  IF coalesce(_mine, 0) < _p.stake_coins THEN RAISE EXCEPTION 'not enough coins' USING ERRCODE = '22023'; END IF;
  IF coalesce(_theirs, 0) < _p.stake_coins THEN RAISE EXCEPTION 'partner no longer has enough coins' USING ERRCODE = '22023'; END IF;
  PERFORM public.acct_coin_move(LEAST(_p.creator_id, _p.partner_id), -_p.stake_coins, 'pact_hold', _p.id);
  PERFORM public.acct_coin_move(GREATEST(_p.creator_id, _p.partner_id), -_p.stake_coins, 'pact_hold', _p.id);
  UPDATE public.pact_stakes SET partner_contract_id = _contract, partner_accepted_at = now(), state = 'escrowed', updated_at = now()
   WHERE id = _p.id RETURNING * INTO _p;
  PERFORM public.acct_notify(_p.connection_id, _uid, _p.creator_id, 'pact_accepted', 'Your partner accepted the pact.', _p.creator_contract_id);
  RETURN _p;
END $$;

CREATE OR REPLACE FUNCTION public.pact_mark_upload_started(_pact uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501'; END IF;
  UPDATE public.pact_stakes SET
    creator_upload_started_at = CASE WHEN creator_id = _uid THEN coalesce(creator_upload_started_at, now()) ELSE creator_upload_started_at END,
    partner_upload_started_at = CASE WHEN partner_id = _uid THEN coalesce(partner_upload_started_at, now()) ELSE partner_upload_started_at END,
    updated_at = now()
   WHERE id = _pact AND (creator_id = _uid OR partner_id = _uid) AND state IN ('escrowed','awaiting_review','disputed') AND now() < deadline_at;
END $$;

CREATE OR REPLACE FUNCTION public.pact_submit_proof(_pact uuid, _proof uuid)
RETURNS public.pact_stakes LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _uid uuid := auth.uid(); _p public.pact_stakes; _side text; _contract uuid; _started timestamptz; _ok boolean;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501'; END IF;
  SELECT * INTO _p FROM public.pact_stakes WHERE id = _pact FOR UPDATE;
  IF NOT FOUND OR _uid NOT IN (_p.creator_id, _p.partner_id) THEN RAISE EXCEPTION 'not found' USING ERRCODE = '42501'; END IF;
  _side := CASE WHEN _uid = _p.creator_id THEN 'creator' ELSE 'partner' END;
  _contract := CASE WHEN _side = 'creator' THEN _p.creator_contract_id ELSE _p.partner_contract_id END;
  _started := CASE WHEN _side = 'creator' THEN _p.creator_upload_started_at ELSE _p.partner_upload_started_at END;
  IF (_side = 'creator' AND _p.creator_proof_id = _proof) OR (_side = 'partner' AND _p.partner_proof_id = _proof) THEN RETURN _p; END IF;
  IF _p.state NOT IN ('escrowed','awaiting_review','disputed')
     OR (CASE WHEN _side = 'creator' THEN _p.creator_result ELSE _p.partner_result END) <> 'pending' THEN
    RAISE EXCEPTION 'proof not accepted now' USING ERRCODE = '22023'; END IF;
  _ok := now() <= _p.deadline_at OR (_started IS NOT NULL AND _started < _p.deadline_at
         AND now() <= _p.deadline_at + pg_catalog.make_interval(mins => _p.grace_minutes));
  IF NOT _ok THEN RAISE EXCEPTION 'deadline passed' USING ERRCODE = '22023'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.proof_submissions s WHERE s.id = _proof AND s.user_id = _uid AND s.contract_id = _contract
                 AND s.status NOT IN ('rejected','unavailable')) THEN
    RAISE EXCEPTION 'proof not found' USING ERRCODE = '42501'; END IF;
  IF _side = 'creator' THEN
    UPDATE public.pact_stakes SET creator_proof_id = _proof, creator_result = 'submitted', creator_review_due_at = now() + interval '24 hours' WHERE id = _p.id;
  ELSE
    UPDATE public.pact_stakes SET partner_proof_id = _proof, partner_result = 'submitted', partner_review_due_at = now() + interval '24 hours' WHERE id = _p.id;
  END IF;
  PERFORM public.acct_notify(_p.connection_id, _uid, CASE WHEN _side = 'creator' THEN _p.partner_id ELSE _p.creator_id END,
    'pact_review_needed', 'Your partner sent proof. Please review within 24 hours.', _contract);
  RETURN public.acct_pact_advance(_p.id);
END $$;

CREATE OR REPLACE FUNCTION public.pact_review(_pact uuid, _approve boolean, _reason text DEFAULT NULL)
RETURNS public.pact_stakes LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _uid uuid := auth.uid(); _p public.pact_stakes; _target text; _proof uuid; _owner uuid; _n integer;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501'; END IF;
  _p := public.acct_pact_advance(_pact);  -- applies any timeout first
  IF _p.id IS NULL OR _uid NOT IN (_p.creator_id, _p.partner_id) THEN RAISE EXCEPTION 'not found' USING ERRCODE = '42501'; END IF;
  _target := CASE WHEN _uid = _p.creator_id THEN 'partner' ELSE 'creator' END;  -- you review the other side
  _proof := CASE WHEN _target = 'creator' THEN _p.creator_proof_id ELSE _p.partner_proof_id END;
  _owner := CASE WHEN _target = 'creator' THEN _p.creator_id ELSE _p.partner_id END;
  IF (CASE WHEN _target = 'creator' THEN _p.creator_result ELSE _p.partner_result END) <> 'submitted' THEN
    RAISE EXCEPTION 'nothing to review' USING ERRCODE = '22023'; END IF;
  IF NOT _approve AND (_reason IS NULL OR char_length(btrim(_reason)) NOT BETWEEN 3 AND 300) THEN
    RAISE EXCEPTION 'a reason is required to reject' USING ERRCODE = '22023'; END IF;
  INSERT INTO public.trust_events(user_id, kind, ref_id, kept) VALUES (_uid, 'review', _proof, true) ON CONFLICT DO NOTHING;
  IF _approve THEN
    IF _target = 'creator' THEN UPDATE public.pact_stakes SET creator_result = 'approved' WHERE id = _p.id;
    ELSE UPDATE public.pact_stakes SET partner_result = 'approved' WHERE id = _p.id; END IF;
    PERFORM public.acct_notify(_p.connection_id, _uid, _owner, 'pact_approved', 'Your partner approved your proof.', NULL);
  ELSE
    INSERT INTO public.pact_disputes(pact_id, proof_id, opened_by, reason, closes_at)
    VALUES (_p.id, _proof, _uid, btrim(_reason), now() + interval '24 hours') ON CONFLICT (proof_id) DO NOTHING;
    GET DIAGNOSTICS _n = ROW_COUNT;
    IF _n = 0 THEN RAISE EXCEPTION 'already rejected' USING ERRCODE = '22023'; END IF;
    IF _target = 'creator' THEN UPDATE public.pact_stakes SET creator_result = 'rejected' WHERE id = _p.id;
    ELSE UPDATE public.pact_stakes SET partner_result = 'rejected' WHERE id = _p.id; END IF;
    PERFORM public.acct_notify(_p.connection_id, _uid, _owner, 'pact_rejected', 'Your partner rejected your proof. 24 hours to resolve.', NULL);
  END IF;
  RETURN public.acct_pact_advance(_p.id);
END $$;

CREATE OR REPLACE FUNCTION public.pact_withdraw_rejection(_pact uuid)
RETURNS public.pact_stakes LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _uid uuid := auth.uid(); _p public.pact_stakes; _d public.pact_disputes;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501'; END IF;
  _p := public.acct_pact_advance(_pact);
  SELECT * INTO _d FROM public.pact_disputes WHERE pact_id = _p.id AND opened_by = _uid AND resolution IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'no open dispute' USING ERRCODE = '22023'; END IF;
  UPDATE public.pact_disputes SET resolution = 'approved', resolved_at = now() WHERE id = _d.id;
  IF _d.proof_id = _p.creator_proof_id THEN UPDATE public.pact_stakes SET creator_result = 'approved' WHERE id = _p.id;
  ELSE UPDATE public.pact_stakes SET partner_result = 'approved' WHERE id = _p.id; END IF;
  PERFORM public.acct_notify(_p.connection_id, _uid, CASE WHEN _uid = _p.creator_id THEN _p.partner_id ELSE _p.creator_id END,
    'pact_dispute_withdrawn', 'Your partner withdrew the rejection. Proof approved.', NULL);
  RETURN public.acct_pact_advance(_p.id);
END $$;

CREATE OR REPLACE FUNCTION public.pact_cancel(_pact uuid)
RETURNS public.pact_stakes LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _uid uuid := auth.uid(); _p public.pact_stakes; _other uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501'; END IF;
  _p := public.acct_pact_advance(_pact);
  IF _p.id IS NULL OR _uid NOT IN (_p.creator_id, _p.partner_id) THEN RAISE EXCEPTION 'not found' USING ERRCODE = '42501'; END IF;
  IF _p.state = 'cancelled' THEN RETURN _p; END IF;
  _other := CASE WHEN _uid = _p.creator_id THEN _p.partner_id ELSE _p.creator_id END;
  IF _p.state = 'pending' THEN  -- creator withdraws or partner declines; nothing was held
    UPDATE public.pact_stakes SET state = 'cancelled', updated_at = now() WHERE id = _p.id RETURNING * INTO _p;
    PERFORM public.acct_notify(_p.connection_id, _uid, _other, 'pact_cancelled', 'The pact invite was closed.', NULL);
    RETURN _p;
  END IF;
  IF _p.state <> 'escrowed' OR now() >= _p.deadline_at THEN RAISE EXCEPTION 'can only cancel before the deadline' USING ERRCODE = '22023'; END IF;
  IF _p.cancel_requested_by IS NULL OR _p.cancel_requested_by = _uid THEN
    UPDATE public.pact_stakes SET cancel_requested_by = _uid, updated_at = now() WHERE id = _p.id RETURNING * INTO _p;
    PERFORM public.acct_notify(_p.connection_id, _uid, _other, 'pact_cancel_requested', 'Your partner asked to cancel the pact.', NULL);
    RETURN _p;
  END IF;
  PERFORM public.acct_refund_both(_p);
  UPDATE public.pact_stakes SET state = 'cancelled', outcome = 'mutual_cancel', settled_at = now(), updated_at = now()
   WHERE id = _p.id RETURNING * INTO _p;
  PERFORM public.acct_notify(_p.connection_id, _uid, _other, 'pact_cancelled', 'Pact cancelled. Both stakes refunded.', NULL);
  RETURN _p;
END $$;

CREATE OR REPLACE FUNCTION public.pact_refresh(_pact uuid)
RETURNS public.pact_stakes LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p public.pact_stakes;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.pact_stakes WHERE id = _pact AND auth.uid() IN (creator_id, partner_id)) THEN
    RAISE EXCEPTION 'not found' USING ERRCODE = '42501'; END IF;
  RETURN public.acct_pact_advance(_pact);
END $$;

-- F. Trust Score 70/30 (self, or your connected partner)
CREATE OR REPLACE FUNCTION public.get_trust_score(_user uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE _uid uuid := auth.uid(); _t uuid := coalesce(_user, auth.uid()); _ck int; _ct int; _rk int; _rt int; _enough boolean;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501'; END IF;
  IF _t <> _uid AND NOT EXISTS (SELECT 1 FROM public.accountability_connections c WHERE c.status = 'active'
       AND ((c.user_id = _uid AND c.partner_id = _t) OR (c.partner_id = _uid AND c.user_id = _t))) THEN
    RAISE EXCEPTION 'not found' USING ERRCODE = '42501'; END IF;
  SELECT count(*) FILTER (WHERE kept), count(*) INTO _ck, _ct FROM public.trust_events WHERE user_id = _t AND kind = 'commitment';
  SELECT count(*) FILTER (WHERE kept), count(*) INTO _rk, _rt FROM public.trust_events WHERE user_id = _t AND kind = 'review';
  _enough := _ct >= 5 AND _rt >= 5;
  RETURN jsonb_build_object(
    'commitment_kept', _ck, 'commitment_total', _ct,
    'commitment_pct', CASE WHEN _ct > 0 THEN round(100.0 * _ck / _ct) END,
    'review_kept', _rk, 'review_total', _rt,
    'review_pct', CASE WHEN _rt > 0 THEN round(100.0 * _rk / _rt) END,
    'enough_data', _enough,
    'score', CASE WHEN _enough THEN round(0.7 * (100.0 * _ck / _ct) + 0.3 * (100.0 * _rk / _rt)) END,
    'label', 'Initial product-defined metric, not a validated measure of character');
END $$;

-- G. Work Together (co-focus)
CREATE OR REPLACE FUNCTION public.acct_cofocus_advance(_id uuid)
RETURNS public.cofocus_sessions LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _s public.cofocus_sessions;
BEGIN
  SELECT * INTO _s FROM public.cofocus_sessions WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RETURN _s; END IF;
  IF _s.status = 'ready' AND _s.created_at < now() - interval '10 minutes' THEN
    UPDATE public.cofocus_sessions SET status = 'no_show' WHERE id = _id RETURNING * INTO _s;
  ELSIF _s.status = 'active' AND now() >= _s.ends_at THEN
    UPDATE public.cofocus_sessions SET status = CASE
      WHEN _s.host_seen_at >= _s.ends_at - interval '2 minutes' AND _s.guest_seen_at >= _s.ends_at - interval '2 minutes'
      THEN 'completed' ELSE 'interrupted' END WHERE id = _id RETURNING * INTO _s;
  ELSIF _s.status = 'active' AND least(_s.host_seen_at, _s.guest_seen_at) < now() - interval '2 minutes' THEN
    UPDATE public.cofocus_sessions SET status = 'interrupted' WHERE id = _id RETURNING * INTO _s;
  END IF;
  RETURN _s;
END $$;

CREATE OR REPLACE FUNCTION public.cofocus_start(_minutes integer, _task text, _quiet boolean DEFAULT false)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _uid uuid := auth.uid(); _c public.accountability_connections; _open uuid; _id uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501'; END IF;
  SELECT * INTO _c FROM public.accountability_connections WHERE status = 'active' AND (user_id = _uid OR partner_id = _uid) LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'no active partner' USING ERRCODE = '42501'; END IF;
  FOR _open IN SELECT id FROM public.cofocus_sessions WHERE connection_id = _c.id AND status IN ('ready','active') LOOP
    PERFORM public.acct_cofocus_advance(_open);
  END LOOP;
  INSERT INTO public.cofocus_sessions(connection_id, host_id, guest_id, task_title, minutes, quiet_mode, host_seen_at)
  VALUES (_c.id, _uid, CASE WHEN _c.user_id = _uid THEN _c.partner_id ELSE _c.user_id END, btrim(_task), _minutes, coalesce(_quiet, false), now())
  RETURNING id INTO _id;  -- unique index: one open session per partnership
  PERFORM public.acct_notify(_c.id, _uid, CASE WHEN _c.user_id = _uid THEN _c.partner_id ELSE _c.user_id END,
    'cofocus_invite', 'Your partner wants to work together now.', NULL);
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.cofocus_join(_id uuid)
RETURNS public.cofocus_sessions LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _uid uuid := auth.uid(); _s public.cofocus_sessions;
BEGIN
  _s := public.acct_cofocus_advance(_id);
  IF _s.id IS NULL OR _s.guest_id IS DISTINCT FROM _uid THEN RAISE EXCEPTION 'not found' USING ERRCODE = '42501'; END IF;
  IF _s.status = 'active' THEN RETURN _s; END IF;
  IF _s.status <> 'ready' THEN RAISE EXCEPTION 'session closed' USING ERRCODE = '22023'; END IF;
  UPDATE public.cofocus_sessions SET status = 'active', guest_seen_at = now(), host_seen_at = greatest(host_seen_at, now() - interval '1 minute'),
    starts_at = now(), ends_at = now() + pg_catalog.make_interval(mins => minutes)
   WHERE id = _id RETURNING * INTO _s;
  PERFORM public.acct_notify(_s.connection_id, _uid, _s.host_id, 'cofocus_started', 'Your partner joined. Timer started.', NULL);
  RETURN _s;
END $$;

CREATE OR REPLACE FUNCTION public.cofocus_heartbeat(_id uuid)
RETURNS public.cofocus_sessions LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.cofocus_sessions WHERE id = _id AND _uid IN (host_id, guest_id)) THEN
    RAISE EXCEPTION 'not found' USING ERRCODE = '42501'; END IF;
  PERFORM public.acct_cofocus_advance(_id);  -- a stale gap is judged before this beat counts
  UPDATE public.cofocus_sessions SET
    host_seen_at = CASE WHEN host_id = _uid THEN now() ELSE host_seen_at END,
    guest_seen_at = CASE WHEN guest_id = _uid THEN now() ELSE guest_seen_at END
   WHERE id = _id AND status IN ('ready','active');
  RETURN public.acct_cofocus_advance(_id);
END $$;

CREATE OR REPLACE FUNCTION public.cofocus_cancel(_id uuid)
RETURNS public.cofocus_sessions LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _uid uuid := auth.uid(); _s public.cofocus_sessions;
BEGIN
  _s := public.acct_cofocus_advance(_id);
  IF _s.id IS NULL OR _uid NOT IN (_s.host_id, _s.guest_id) THEN RAISE EXCEPTION 'not found' USING ERRCODE = '42501'; END IF;
  IF _s.status IN ('ready','active') THEN
    UPDATE public.cofocus_sessions SET status = 'cancelled' WHERE id = _id RETURNING * INTO _s;
  END IF;
  RETURN _s;
END $$;

CREATE OR REPLACE FUNCTION public.cofocus_checkin(_id uuid, _result text)
RETURNS public.cofocus_sessions LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _uid uuid := auth.uid(); _s public.cofocus_sessions;
BEGIN
  IF _result NOT IN ('completed','partial','not_completed') THEN RAISE EXCEPTION 'invalid check-in' USING ERRCODE = '22023'; END IF;
  _s := public.acct_cofocus_advance(_id);
  IF _s.id IS NULL OR _uid NOT IN (_s.host_id, _s.guest_id) THEN RAISE EXCEPTION 'not found' USING ERRCODE = '42501'; END IF;
  IF _s.status NOT IN ('completed','interrupted') THEN RAISE EXCEPTION 'session not finished' USING ERRCODE = '22023'; END IF;
  UPDATE public.cofocus_sessions SET
    host_checkin = CASE WHEN host_id = _uid THEN coalesce(host_checkin, _result) ELSE host_checkin END,
    guest_checkin = CASE WHEN guest_id = _uid THEN coalesce(guest_checkin, _result) ELSE guest_checkin END
   WHERE id = _id RETURNING * INTO _s;
  RETURN _s;
END $$;

-- H. Recovery (missed stays missed; no coins)
CREATE OR REPLACE FUNCTION public.recovery_choose(_contract uuid, _reason text, _action text, _restart_minutes integer DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _uid uuid := auth.uid(); _id uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.daily_contracts WHERE id = _contract AND user_id = _uid AND status = 'missed') THEN
    RAISE EXCEPTION 'missed contract not found' USING ERRCODE = '42501'; END IF;
  IF _action = 'restart' AND (_restart_minutes IS NULL OR _restart_minutes NOT BETWEEN 5 AND 10) THEN
    RAISE EXCEPTION 'restart is 5-10 minutes' USING ERRCODE = '22023'; END IF;
  INSERT INTO public.recovery_choices(user_id, contract_id, reason, action, restart_minutes)
  VALUES (_uid, _contract, _reason, _action, CASE WHEN _action = 'restart' THEN _restart_minutes END)
  ON CONFLICT (contract_id) DO NOTHING RETURNING id INTO _id;
  IF _id IS NULL THEN RAISE EXCEPTION 'recovery already chosen' USING ERRCODE = '22023'; END IF;
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.recovery_complete_restart(_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _n integer;
BEGIN
  UPDATE public.recovery_choices SET completed_at = now()
   WHERE id = _id AND user_id = auth.uid() AND action = 'restart' AND completed_at IS NULL
     AND now() >= created_at + pg_catalog.make_interval(mins => restart_minutes);
  GET DIAGNOSTICS _n = ROW_COUNT;
  RETURN _n > 0 OR EXISTS (SELECT 1 FROM public.recovery_choices WHERE id = _id AND user_id = auth.uid() AND completed_at IS NOT NULL);
END $$;

-- I. Weekly review (last 7 local days, real data only)
CREATE OR REPLACE FUNCTION public.get_weekly_review()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE _uid uuid := auth.uid(); _tz text; _from date; _total int; _done int; _restarts int; _top text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501'; END IF;
  SELECT coalesce(reward_timezone, 'Asia/Kolkata') INTO _tz FROM public.profiles WHERE id = _uid;
  _from := (now() AT TIME ZONE _tz)::date - 6;
  SELECT count(*) FILTER (WHERE status IN ('verified','rewarded','missed')),
         count(*) FILTER (WHERE status IN ('verified','rewarded'))
    INTO _total, _done FROM public.daily_contracts WHERE user_id = _uid AND local_day >= _from AND NOT is_recovery;
  SELECT count(*) INTO _restarts FROM public.recovery_choices WHERE user_id = _uid AND (created_at AT TIME ZONE _tz)::date >= _from;
  SELECT reason INTO _top FROM public.recovery_choices WHERE user_id = _uid AND (created_at AT TIME ZONE _tz)::date >= _from
   GROUP BY reason ORDER BY count(*) DESC, max(created_at) DESC LIMIT 1;
  RETURN jsonb_build_object('from', _from, 'finished', _total, 'completed', _done,
    'completion_pct', CASE WHEN _total > 0 THEN round(100.0 * _done / _total) END,
    'restarts', _restarts, 'top_obstacle', _top, 'enough_data', _total >= 3,
    'suggestion', CASE _top
      WHEN 'too_much' THEN 'Try a smaller first step for next week''s commitments.'
      WHEN 'started_late' THEN 'Set the start time earlier or add a 2-minute warm-up.'
      WHEN 'unexpected' THEN 'Add a fallback action to each commitment.'
      WHEN 'low_energy' THEN 'Schedule hard tasks when your energy is highest.'
      ELSE NULL END);
END $$;

-- J. Free-text partner messages
CREATE OR REPLACE FUNCTION public.send_partner_message(_body text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _uid uuid := auth.uid(); _c public.accountability_connections; _id uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501'; END IF;
  IF _body IS NULL OR char_length(btrim(_body)) NOT BETWEEN 1 AND 280 THEN RAISE EXCEPTION 'message must be 1-280 characters' USING ERRCODE = '22023'; END IF;
  SELECT * INTO _c FROM public.accountability_connections WHERE status = 'active' AND (user_id = _uid OR partner_id = _uid) LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'no active partner' USING ERRCODE = '42501'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(_uid::text, 74311));
  IF (SELECT count(*) FROM public.partner_messages WHERE sender_id = _uid AND created_at > now() - interval '1 hour') >= 30 THEN
    RAISE EXCEPTION 'too many messages, try again later' USING ERRCODE = '22023'; END IF;
  INSERT INTO public.partner_messages(connection_id, sender_id, recipient_id, body)
  VALUES (_c.id, _uid, CASE WHEN _c.user_id = _uid THEN _c.partner_id ELSE _c.user_id END, btrim(_body)) RETURNING id INTO _id;
  RETURN _id;
END $$;

-- K. Early warning 2h before deadline (one per deadline, quiet hours 22:00-07:00 local)
CREATE OR REPLACE FUNCTION public.acct_contract_reminder_sync()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _fire timestamptz; _local timestamp; _skip boolean := false; _key text;
BEGIN
  IF NEW.deadline_at IS NULL OR NEW.status NOT IN ('draft','scheduled','active') THEN
    UPDATE public.commitment_reminders SET status = 'suppressed' WHERE contract_id = NEW.id AND status = 'scheduled';
    RETURN NEW;
  END IF;
  _key := 'early:' || NEW.id::text || ':' || extract(epoch FROM NEW.deadline_at)::bigint::text;
  IF EXISTS (SELECT 1 FROM public.commitment_reminders WHERE contract_id = NEW.id AND idempotency_key = _key) THEN RETURN NEW; END IF;
  _fire := NEW.deadline_at - interval '2 hours';
  IF _fire < now() THEN _skip := true; END IF;  -- created/rescheduled less than 2h before deadline
  _local := _fire AT TIME ZONE NEW.timezone;
  IF NOT _skip AND (_local::time >= time '22:00' OR _local::time < time '07:00') THEN
    _fire := (date_trunc('day', _local) + CASE WHEN _local::time >= time '22:00' THEN interval '31 hours' ELSE interval '7 hours' END) AT TIME ZONE NEW.timezone;
    IF _fire > NEW.deadline_at - interval '30 minutes' THEN _skip := true; END IF;
  END IF;
  INSERT INTO public.commitment_reminders(user_id, contract_id, idempotency_key, fire_at, timezone, status)
  VALUES (NEW.user_id, NEW.id, _key, _fire, NEW.timezone, CASE WHEN _skip THEN 'skipped' ELSE 'scheduled' END)
  ON CONFLICT (contract_id, kind) DO UPDATE SET idempotency_key = EXCLUDED.idempotency_key, fire_at = EXCLUDED.fire_at,
    timezone = EXCLUDED.timezone, status = EXCLUDED.status, sent_at = NULL;
  RETURN NEW;
END $$;
CREATE TRIGGER acct_contract_reminder_sync AFTER INSERT OR UPDATE OF deadline_at, status ON public.daily_contracts
  FOR EACH ROW EXECUTE FUNCTION public.acct_contract_reminder_sync();

CREATE OR REPLACE FUNCTION public.claim_my_due_reminders()
RETURNS TABLE(reminder_id uuid, contract_id uuid, title text, deadline_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501'; END IF;
  UPDATE public.commitment_reminders r SET status = 'suppressed'
    FROM public.daily_contracts c
   WHERE r.contract_id = c.id AND r.user_id = auth.uid() AND r.status = 'scheduled' AND r.fire_at <= now()
     AND (c.status NOT IN ('draft','scheduled','active') OR c.deadline_at <= now());
  RETURN QUERY
  WITH due AS (
    SELECT r.id FROM public.commitment_reminders r
     WHERE r.user_id = auth.uid() AND r.status = 'scheduled' AND r.fire_at <= now()
     FOR UPDATE SKIP LOCKED)
  UPDATE public.commitment_reminders r SET status = 'sent', sent_at = now()
    FROM due, public.daily_contracts c
   WHERE r.id = due.id AND c.id = r.contract_id
  RETURNING r.id, r.contract_id, c.title, c.deadline_at;
END $$;

-- L. Background job: every minute, bounded batches
CREATE OR REPLACE FUNCTION public.acct_sweep()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _id uuid;
BEGIN
  FOR _id IN SELECT id FROM public.pact_stakes WHERE state NOT IN ('settled','cancelled') ORDER BY updated_at LIMIT 500 FOR UPDATE SKIP LOCKED LOOP
    PERFORM public.acct_pact_advance(_id);
  END LOOP;
  FOR _id IN SELECT id FROM public.cofocus_sessions WHERE status IN ('ready','active') LIMIT 500 FOR UPDATE SKIP LOCKED LOOP
    PERFORM public.acct_cofocus_advance(_id);
  END LOOP;
  UPDATE public.commitment_reminders r SET status = 'suppressed'
    FROM public.daily_contracts c
   WHERE r.contract_id = c.id AND r.status = 'scheduled'
     AND (c.status NOT IN ('draft','scheduled','active') OR c.deadline_at <= now());
END $$;
SELECT cron.schedule('axen-acct-sweep', '* * * * *', 'select public.acct_sweep();');

-- M. Permissions: internal helpers callable by no one; actions only by signed-in users
REVOKE ALL ON FUNCTION public.acct_coin_move(uuid, integer, text, uuid), public.acct_notify(uuid, uuid, uuid, text, text, uuid),
  public.acct_refund_both(public.pact_stakes), public.acct_pact_advance(uuid), public.acct_cofocus_advance(uuid),
  public.acct_contract_reminder_sync(), public.acct_sweep() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pact_create(uuid, integer, timestamptz), public.pact_accept(uuid, uuid, integer),
  public.pact_mark_upload_started(uuid), public.pact_submit_proof(uuid, uuid), public.pact_review(uuid, boolean, text),
  public.pact_withdraw_rejection(uuid), public.pact_cancel(uuid), public.pact_refresh(uuid), public.get_trust_score(uuid),
  public.cofocus_start(integer, text, boolean), public.cofocus_join(uuid), public.cofocus_heartbeat(uuid),
  public.cofocus_cancel(uuid), public.cofocus_checkin(uuid, text), public.recovery_choose(uuid, text, text, integer),
  public.recovery_complete_restart(uuid), public.get_weekly_review(), public.send_partner_message(text),
  public.claim_my_due_reminders() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pact_create(uuid, integer, timestamptz), public.pact_accept(uuid, uuid, integer),
  public.pact_mark_upload_started(uuid), public.pact_submit_proof(uuid, uuid), public.pact_review(uuid, boolean, text),
  public.pact_withdraw_rejection(uuid), public.pact_cancel(uuid), public.pact_refresh(uuid), public.get_trust_score(uuid),
  public.cofocus_start(integer, text, boolean), public.cofocus_join(uuid), public.cofocus_heartbeat(uuid),
  public.cofocus_cancel(uuid), public.cofocus_checkin(uuid, text), public.recovery_choose(uuid, text, text, integer),
  public.recovery_complete_restart(uuid), public.get_weekly_review(), public.send_partner_message(text),
  public.claim_my_due_reminders() TO authenticated;
```

## After you approve
1. Apply the SQL above, then run server tests with temporary accounts:
   - every row of the settlement matrix, plus disputes and both timeouts;
   - two settlements at the same moment, and duplicate requests;
   - not enough coins, and a stranger trying to touch someone else's pact;
   - Work Together no-show, disconnect and finish;
   - reminder skip, quiet-hours shift and suppression;
   - message rate limit.

   Then delete every test account and its data.
2. Show you Phase 3, the Accountability screen changes, before building them.
