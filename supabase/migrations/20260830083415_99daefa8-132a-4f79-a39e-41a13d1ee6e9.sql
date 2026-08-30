
-- ============ 1. profile additions: shields, onboarding, referrals ============
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS shields integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS onboarded boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS referral_code text,
  ADD COLUMN IF NOT EXISTS referred_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_referral_code_key ON public.profiles(referral_code) WHERE referral_code IS NOT NULL;

-- protect new economy columns from direct client writes
CREATE OR REPLACE FUNCTION public.guard_profile_economy()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  IF coalesce(current_setting('app.economy_write', true), 'off') <> 'on' THEN
    NEW.coins := OLD.coins;
    NEW.streak := OLD.streak;
    NEW.longest_streak := OLD.longest_streak;
    NEW.last_activity_date := OLD.last_activity_date;
    NEW.last_penalty_date := OLD.last_penalty_date;
    NEW.shields := OLD.shields;
    NEW.referral_code := OLD.referral_code;
    NEW.referred_by := OLD.referred_by;
  END IF;
  RETURN NEW;
END;
$function$;

-- ============ 2. streak shield uses (idempotency ledger) ============
CREATE TABLE IF NOT EXISTS public.streak_shield_uses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  used_for date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, used_for)
);
GRANT SELECT ON public.streak_shield_uses TO authenticated;
GRANT ALL ON public.streak_shield_uses TO service_role;
ALTER TABLE public.streak_shield_uses ENABLE ROW LEVEL SECURITY;
CREATE POLICY shield_uses_select_own ON public.streak_shield_uses FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- ============ 3. habit reminders ============
CREATE TABLE IF NOT EXISTS public.habit_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  remind_at time NOT NULL DEFAULT '07:00',
  timezone text NOT NULL DEFAULT 'UTC',
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, task_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.habit_reminders TO authenticated;
GRANT ALL ON public.habit_reminders TO service_role;
ALTER TABLE public.habit_reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY habit_reminders_select_own ON public.habit_reminders FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY habit_reminders_insert_own ON public.habit_reminders FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY habit_reminders_update_own ON public.habit_reminders FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY habit_reminders_delete_own ON public.habit_reminders FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER habit_reminders_updated_at BEFORE UPDATE ON public.habit_reminders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ 4. friendships ============
CREATE TABLE IF NOT EXISTS public.friendships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  addressee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (requester_id <> addressee_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS friendships_pair_key
  ON public.friendships (LEAST(requester_id, addressee_id), GREATEST(requester_id, addressee_id));
GRANT SELECT ON public.friendships TO authenticated;
GRANT ALL ON public.friendships TO service_role;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
CREATE POLICY friendships_select_involved ON public.friendships FOR SELECT TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

-- ============ 5. shield economy functions ============
CREATE OR REPLACE FUNCTION public.buy_streak_shield()
RETURNS TABLE(coins integer, shields integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  _uid uuid := auth.uid();
  _cost constant integer := 150;
  _max constant integer := 3;
  _coins integer; _shields integer;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  PERFORM set_config('app.economy_write', 'on', true);

  SELECT p.coins, p.shields INTO _coins, _shields FROM public.profiles p WHERE p.id = _uid FOR UPDATE;
  IF _shields >= _max THEN RAISE EXCEPTION 'shield limit reached'; END IF;
  IF _coins < _cost THEN RAISE EXCEPTION 'not enough coins'; END IF;

  UPDATE public.profiles p SET coins = p.coins - _cost, shields = p.shields + 1 WHERE p.id = _uid
    RETURNING p.coins, p.shields INTO _coins, _shields;
  INSERT INTO public.coin_transactions(user_id, amount, reason) VALUES (_uid, -_cost, 'shield_purchase');

  coins := _coins; shields := _shields; RETURN NEXT;
END; $$;

CREATE OR REPLACE FUNCTION public.use_streak_shield()
RETURNS TABLE(shields integer, applied boolean, reason text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  _uid uuid := auth.uid();
  _yesterday date := ((now() AT TIME ZONE 'utc')::date) - 1;
  _shields integer; _last date; _total int; _done int;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  PERFORM set_config('app.economy_write', 'on', true);

  SELECT p.shields, p.last_activity_date INTO _shields, _last
    FROM public.profiles p WHERE p.id = _uid FOR UPDATE;

  IF _shields IS NULL OR _shields <= 0 THEN
    shields := coalesce(_shields, 0); applied := false; reason := 'no_shields'; RETURN NEXT; RETURN;
  END IF;

  SELECT count(*) INTO _total FROM public.tasks t WHERE t.user_id = _uid AND t.is_active;
  SELECT count(*) INTO _done FROM public.task_completions tc WHERE tc.user_id = _uid AND tc.completed_on = _yesterday;
  IF _total = 0 OR _done >= _total THEN
    shields := _shields; applied := false; reason := 'nothing_to_protect'; RETURN NEXT; RETURN;
  END IF;

  IF _last IS NULL OR _last >= _yesterday OR _last < _yesterday - 1 THEN
    shields := _shields; applied := false; reason := 'no_streak_at_risk'; RETURN NEXT; RETURN;
  END IF;

  BEGIN
    INSERT INTO public.streak_shield_uses(user_id, used_for) VALUES (_uid, _yesterday);
  EXCEPTION WHEN unique_violation THEN
    shields := _shields; applied := false; reason := 'already_used'; RETURN NEXT; RETURN;
  END;

  UPDATE public.profiles p
    SET shields = p.shields - 1,
        last_activity_date = _yesterday,
        last_penalty_date = GREATEST(coalesce(p.last_penalty_date, _yesterday), _yesterday)
    WHERE p.id = _uid
    RETURNING p.shields INTO _shields;

  shields := _shields; applied := true; reason := 'protected'; RETURN NEXT;
END; $$;

-- ============ 6. referrals ============
CREATE OR REPLACE FUNCTION public.get_or_create_referral_code()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  _uid uuid := auth.uid();
  _code text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT p.referral_code INTO _code FROM public.profiles p WHERE p.id = _uid;
  IF _code IS NOT NULL THEN RETURN _code; END IF;

  PERFORM set_config('app.economy_write', 'on', true);
  FOR i IN 1..8 LOOP
    _code := 'AXEN' || upper(substr(encode(gen_random_bytes(5), 'hex'), 1, 6));
    BEGIN
      UPDATE public.profiles p SET referral_code = _code WHERE p.id = _uid;
      RETURN _code;
    EXCEPTION WHEN unique_violation THEN
      NULL;
    END;
  END LOOP;
  RAISE EXCEPTION 'could not allocate referral code';
END; $$;

CREATE OR REPLACE FUNCTION public.redeem_referral_code(_code text)
RETURNS TABLE(coins integer, applied boolean, reason text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  _uid uuid := auth.uid();
  _bonus constant integer := 50;
  _referrer uuid;
  _existing uuid;
  _created timestamptz;
  _coins integer;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  PERFORM set_config('app.economy_write', 'on', true);

  SELECT p.referred_by, p.created_at, p.coins INTO _existing, _created, _coins
    FROM public.profiles p WHERE p.id = _uid FOR UPDATE;

  IF _existing IS NOT NULL THEN
    coins := _coins; applied := false; reason := 'already_referred'; RETURN NEXT; RETURN;
  END IF;
  IF _created < now() - interval '14 days' THEN
    coins := _coins; applied := false; reason := 'account_too_old'; RETURN NEXT; RETURN;
  END IF;

  SELECT p.id INTO _referrer FROM public.profiles p WHERE p.referral_code = upper(trim(_code));
  IF _referrer IS NULL THEN
    coins := _coins; applied := false; reason := 'invalid_code'; RETURN NEXT; RETURN;
  END IF;
  IF _referrer = _uid THEN
    coins := _coins; applied := false; reason := 'self_referral'; RETURN NEXT; RETURN;
  END IF;

  UPDATE public.profiles p SET referred_by = _referrer, coins = p.coins + _bonus
    WHERE p.id = _uid AND p.referred_by IS NULL
    RETURNING p.coins INTO _coins;
  IF _coins IS NULL THEN
    SELECT p.coins INTO _coins FROM public.profiles p WHERE p.id = _uid;
    coins := _coins; applied := false; reason := 'already_referred'; RETURN NEXT; RETURN;
  END IF;

  INSERT INTO public.coin_transactions(user_id, amount, reason, ref_id) VALUES (_uid, _bonus, 'referral_joined', _referrer);
  UPDATE public.profiles p SET coins = p.coins + _bonus WHERE p.id = _referrer;
  INSERT INTO public.coin_transactions(user_id, amount, reason, ref_id) VALUES (_referrer, _bonus, 'referral_bonus', _uid);

  coins := _coins; applied := true; reason := 'ok'; RETURN NEXT;
END; $$;

-- ============ 7. friend functions ============
CREATE OR REPLACE FUNCTION public.send_friend_request(_username text)
RETURNS TABLE(ok boolean, reason text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  _uid uuid := auth.uid();
  _target uuid;
  _row public.friendships%ROWTYPE;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  SELECT p.id INTO _target FROM public.profiles p
    WHERE lower(coalesce(p.username, '')) = lower(trim(_username))
       OR lower(coalesce(p.display_name, '')) = lower(trim(_username))
    LIMIT 1;

  IF _target IS NULL THEN ok := false; reason := 'user_not_found'; RETURN NEXT; RETURN; END IF;
  IF _target = _uid THEN ok := false; reason := 'cannot_add_yourself'; RETURN NEXT; RETURN; END IF;

  SELECT * INTO _row FROM public.friendships f
    WHERE LEAST(f.requester_id, f.addressee_id) = LEAST(_uid, _target)
      AND GREATEST(f.requester_id, f.addressee_id) = GREATEST(_uid, _target);

  IF FOUND THEN
    IF _row.status = 'accepted' THEN ok := false; reason := 'already_friends'; RETURN NEXT; RETURN; END IF;
    IF _row.status = 'pending' THEN ok := false; reason := 'request_pending'; RETURN NEXT; RETURN; END IF;
    UPDATE public.friendships f SET status = 'pending', requester_id = _uid, addressee_id = _target, updated_at = now()
      WHERE f.id = _row.id;
    ok := true; reason := 'sent'; RETURN NEXT; RETURN;
  END IF;

  INSERT INTO public.friendships(requester_id, addressee_id, status) VALUES (_uid, _target, 'pending');
  ok := true; reason := 'sent'; RETURN NEXT;
EXCEPTION WHEN unique_violation THEN
  ok := false; reason := 'request_pending'; RETURN NEXT;
END; $$;

CREATE OR REPLACE FUNCTION public.respond_friend_request(_request_id uuid, _accept boolean)
RETURNS TABLE(ok boolean, reason text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  _uid uuid := auth.uid();
  _n int;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  UPDATE public.friendships f
    SET status = CASE WHEN _accept THEN 'accepted' ELSE 'rejected' END, updated_at = now()
    WHERE f.id = _request_id AND f.addressee_id = _uid AND f.status = 'pending';
  GET DIAGNOSTICS _n = ROW_COUNT;
  ok := _n > 0; reason := CASE WHEN _n > 0 THEN 'updated' ELSE 'not_pending' END; RETURN NEXT;
END; $$;

CREATE OR REPLACE FUNCTION public.list_friends()
RETURNS TABLE(
  friendship_id uuid, friend_id uuid, display_name text, username text, avatar_url text,
  coins integer, streak integer, longest_streak integer, status text, direction text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT f.id,
         p.id,
         p.display_name,
         p.username,
         p.avatar_url,
         p.coins,
         p.streak,
         p.longest_streak,
         f.status,
         CASE WHEN f.requester_id = auth.uid() THEN 'outgoing' ELSE 'incoming' END
  FROM public.friendships f
  JOIN public.profiles p
    ON p.id = CASE WHEN f.requester_id = auth.uid() THEN f.addressee_id ELSE f.requester_id END
  WHERE auth.uid() IN (f.requester_id, f.addressee_id)
    AND f.status IN ('pending','accepted')
  ORDER BY f.status DESC, p.coins DESC;
$$;

-- ============ 8. execute grants (authenticated only) ============
REVOKE ALL ON FUNCTION public.buy_streak_shield() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.use_streak_shield() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_or_create_referral_code() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.redeem_referral_code(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.send_friend_request(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.respond_friend_request(uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_friends() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.buy_streak_shield() TO authenticated;
GRANT EXECUTE ON FUNCTION public.use_streak_shield() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_or_create_referral_code() TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_referral_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_friend_request(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_friend_request(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_friends() TO authenticated;
