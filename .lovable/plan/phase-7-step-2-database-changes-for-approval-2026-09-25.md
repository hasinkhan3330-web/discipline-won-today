# Phase 7 — Step 2: Database changes for approval

The audit is approved. This is the complete database change. Nothing is applied until you approve it. After that I will show the exact screen changes for a second approval.

Deep Focus is not touched at all (including line 283). Phases 1–6, award_contract, score_events, coins, ranks, Zen and navigation are also untouched. The old pacts feature stays as it is.

## What this does, in plain words
- Each partner gets their own **sharing** switch and their own **mute** switch. The old shared switch stays in the table but is no longer used.
- **Invites:**
  - expire after 24 hours
  - at most 3 per day and 1 per hour
  - refused with "You already have a partner" if you already have one
  - every bad code (expired, used, your own, unknown) gets the same message: "Invite invalid or expired"
- **Nudges:**
  - only these 4 messages: "You've got this", "Start now", "Great work", "Try the rescue version"
  - at most 3 per contract and 10 per day
  - blocked when the receiver has muted you
  - nothing can be sent once the partner is blocked or removed
- **Partner view:** only the partner's today's contract title, status and start time, and only when that partner's sharing is on
- **Your own status:** partner name, photo and the switch states. No email, coins, XP or notes.
- **Revoke and block:** kept exactly as they are. "Report" uses block.
- **The invite code** is made on the server (next step). The database still stores only its hash.

## Technical details (full SQL)

```sql
-- 1. Per-side sharing and mute (additive)
ALTER TABLE public.accountability_connections
  ADD COLUMN IF NOT EXISTS share_by_user    boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS share_by_partner boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS muted_by_user    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS muted_by_partner boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS aev_actor_contract_idx ON public.accountability_events (actor_id, contract_id, kind);
CREATE INDEX IF NOT EXISTS aev_actor_recipient_day_idx ON public.accountability_events (actor_id, recipient_id, created_at);
CREATE INDEX IF NOT EXISTS ai_inviter_created_idx ON public.accountability_invites (inviter_id, created_at);

-- 2. Create invite (same signature, stricter rules)
CREATE OR REPLACE FUNCTION public.create_accountability_invite(_token_hash text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE _uid uuid := auth.uid(); _id uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501'; END IF;
  IF _token_hash IS NULL OR _token_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'Invite invalid or expired' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.accountability_connections
             WHERE status = 'active' AND (user_id = _uid OR partner_id = _uid)) THEN
    RAISE EXCEPTION 'You already have a partner' USING ERRCODE = '23505';
  END IF;
  IF (SELECT count(*) FROM public.accountability_invites
      WHERE inviter_id = _uid AND created_at > now() - interval '1 day') >= 3 THEN
    RAISE EXCEPTION 'Invite limit reached for today' USING ERRCODE = '54000';
  END IF;
  IF EXISTS (SELECT 1 FROM public.accountability_invites
             WHERE inviter_id = _uid AND created_at > now() - interval '1 hour') THEN
    RAISE EXCEPTION 'Please wait an hour before a new invite' USING ERRCODE = '54000';
  END IF;
  PERFORM pg_catalog.set_config('axen.contract_write', 'on', true);
  INSERT INTO public.accountability_invites(inviter_id, token_hash, expires_at)
  VALUES (_uid, _token_hash, now() + interval '24 hours') RETURNING id INTO _id;
  RETURN _id;
END $$;

-- 3. Accept invite (same signature, generic error)
CREATE OR REPLACE FUNCTION public.accept_accountability_invite(_token_hash text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE _uid uuid := auth.uid(); _i public.accountability_invites; _cid uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501'; END IF;
  SELECT * INTO _i FROM public.accountability_invites WHERE token_hash = _token_hash FOR UPDATE;
  IF NOT FOUND OR _i.accepted_at IS NOT NULL OR _i.revoked_at IS NOT NULL
     OR _i.expires_at <= now() OR _i.inviter_id = _uid THEN
    RAISE EXCEPTION 'Invite invalid or expired' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.accountability_connections
             WHERE status = 'active' AND (user_id IN (_uid, _i.inviter_id) OR partner_id IN (_uid, _i.inviter_id))) THEN
    RAISE EXCEPTION 'You already have a partner' USING ERRCODE = '23505';
  END IF;
  PERFORM pg_catalog.set_config('axen.contract_write', 'on', true);
  UPDATE public.accountability_invites SET accepted_by = _uid, accepted_at = now() WHERE id = _i.id;
  INSERT INTO public.accountability_connections(user_id, partner_id, invite_id)
  VALUES (_i.inviter_id, _uid, _i.id) RETURNING id INTO _cid;
  INSERT INTO public.accountability_events(connection_id, actor_id, recipient_id, kind)
  VALUES (_cid, _uid, _i.inviter_id, 'connected');
  RETURN _cid;
END $$;

-- 4. Nudge (same signature; fixed messages; new limits; mute)
CREATE OR REPLACE FUNCTION public.send_accountability_nudge(_connection_id uuid, _kind text, _message text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE _uid uuid := auth.uid(); _c public.accountability_connections;
        _to uuid; _muted boolean; _contract uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501'; END IF;
  IF _kind IS DISTINCT FROM 'nudge' OR _message IS NULL OR _message NOT IN
     ('You''ve got this','Start now','Great work','Try the rescue version') THEN
    RAISE EXCEPTION 'invalid nudge' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO _c FROM public.accountability_connections
   WHERE id = _connection_id AND status = 'active' AND (user_id = _uid OR partner_id = _uid);
  IF NOT FOUND THEN RAISE EXCEPTION 'no active connection' USING ERRCODE = '42501'; END IF;
  IF _c.user_id = _uid THEN _to := _c.partner_id; _muted := _c.muted_by_partner;
  ELSE _to := _c.user_id; _muted := _c.muted_by_user; END IF;
  IF _muted THEN RAISE EXCEPTION 'partner has muted nudges' USING ERRCODE = '42501'; END IF;
  SELECT d.id INTO _contract FROM public.daily_contracts d
   WHERE d.user_id = _to AND d.is_recovery = false AND d.status <> 'cancelled'
     AND d.local_day = (now() AT TIME ZONE d.timezone)::date LIMIT 1;
  IF _contract IS NOT NULL AND (SELECT count(*) FROM public.accountability_events
      WHERE actor_id = _uid AND contract_id = _contract AND kind = 'nudge') >= 3 THEN
    RAISE EXCEPTION 'nudge limit for this contract' USING ERRCODE = '54000';
  END IF;
  IF (SELECT count(*) FROM public.accountability_events
      WHERE actor_id = _uid AND recipient_id = _to AND kind IN ('nudge','cheer')
        AND created_at > now() - interval '24 hours') >= 10 THEN
    RAISE EXCEPTION 'daily nudge limit' USING ERRCODE = '54000';
  END IF;
  PERFORM pg_catalog.set_config('axen.contract_write', 'on', true);
  INSERT INTO public.accountability_events(connection_id, actor_id, recipient_id, kind, message, contract_id)
  VALUES (_c.id, _uid, _to, 'nudge', _message, _contract);
END $$;

-- 5. Own sharing / mute switches (only your own side)
CREATE OR REPLACE FUNCTION public.set_accountability_prefs(_share boolean DEFAULT NULL, _mute boolean DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE _uid uuid := auth.uid(); _c public.accountability_connections;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501'; END IF;
  SELECT * INTO _c FROM public.accountability_connections
   WHERE status = 'active' AND (user_id = _uid OR partner_id = _uid) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'no active connection' USING ERRCODE = '42501'; END IF;
  PERFORM pg_catalog.set_config('axen.contract_write', 'on', true);
  IF _c.user_id = _uid THEN
    UPDATE public.accountability_connections
       SET share_by_user = coalesce(_share, share_by_user), muted_by_user = coalesce(_mute, muted_by_user)
     WHERE id = _c.id;
  ELSE
    UPDATE public.accountability_connections
       SET share_by_partner = coalesce(_share, share_by_partner), muted_by_partner = coalesce(_mute, muted_by_partner)
     WHERE id = _c.id;
  END IF;
END $$;

-- 6. My connection (safe fields only)
CREATE OR REPLACE FUNCTION public.get_my_accountability()
RETURNS TABLE(connection_id uuid, partner_name text, partner_avatar text,
              my_sharing boolean, partner_sharing boolean, i_muted boolean, since timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
  SELECT a.id,
         coalesce(p.display_name, p.username, 'Partner'),
         p.avatar_url,
         CASE WHEN a.user_id = auth.uid() THEN a.share_by_user ELSE a.share_by_partner END,
         CASE WHEN a.user_id = auth.uid() THEN a.share_by_partner ELSE a.share_by_user END,
         CASE WHEN a.user_id = auth.uid() THEN a.muted_by_user ELSE a.muted_by_partner END,
         a.created_at
  FROM public.accountability_connections a
  LEFT JOIN public.profiles p
    ON p.id = CASE WHEN a.user_id = auth.uid() THEN a.partner_id ELSE a.user_id END
  WHERE a.status = 'active' AND (a.user_id = auth.uid() OR a.partner_id = auth.uid())
  LIMIT 1;
$$;

-- 7. Partner's today summary: 3 fields, only if the partner shares
CREATE OR REPLACE FUNCTION public.get_partner_contract_summary()
RETURNS TABLE(title text, status public.contract_status, started_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
  SELECT d.title, d.status, d.started_at
  FROM public.accountability_connections a
  JOIN public.daily_contracts d
    ON d.user_id = CASE WHEN a.user_id = auth.uid() THEN a.partner_id ELSE a.user_id END
  WHERE a.status = 'active'
    AND (a.user_id = auth.uid() OR a.partner_id = auth.uid())
    AND (CASE WHEN a.user_id = auth.uid() THEN a.share_by_partner ELSE a.share_by_user END)
    AND d.is_recovery = false AND d.status <> 'cancelled'
    AND d.local_day = (now() AT TIME ZONE d.timezone)::date
  LIMIT 1;
$$;

-- 8. Permissions: signed-in only
REVOKE ALL ON FUNCTION public.create_accountability_invite(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.accept_accountability_invite(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.send_accountability_nudge(uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_accountability_prefs(boolean, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_my_accountability() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_partner_contract_summary() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.revoke_accountability_connection(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_accountability_invite(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_accountability_invite(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_accountability_nudge(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_accountability_prefs(boolean, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_accountability() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_partner_contract_summary() TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_accountability_connection(uuid, boolean) TO authenticated;
```

## Notes
- **The contract row stays private.** The partner never reads the contract table, notes, proof, coins or XP. Only the function in section 7 returns 3 fields.
- **Existing rows:** the new switches start with sharing on and mute off. There are currently no active connections.
- **Invite limit:** "1 per target per hour" is applied as 1 invite per hour, because invites are share codes that don't name a person.
- **Next step, after your approval:**
  - I apply this SQL.
  - I show the exact screen line changes: the new Accountability section, one Profile grid item, one line on the contract card, the accountability switch in the contract form, and the keep-awake switch plus Do Not Disturb tip on the contract focus screen only.
