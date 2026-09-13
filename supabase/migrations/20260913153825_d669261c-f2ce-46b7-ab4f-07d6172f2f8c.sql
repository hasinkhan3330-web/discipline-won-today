ALTER TABLE public.alarms DROP CONSTRAINT IF EXISTS alarms_challenge_type_check;
ALTER TABLE public.alarms ADD CONSTRAINT alarms_challenge_type_check
  CHECK (challenge_type = ANY (ARRAY['math'::text, 'physics'::text, 'science'::text, 'none'::text]));

CREATE OR REPLACE FUNCTION public.wake_slot_reward(_slot text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE upper(trim(_slot))
    WHEN '4AM' THEN 21
    WHEN '5AM' THEN 17
    WHEN '6AM' THEN 9
    WHEN '7AM' THEN 5
    ELSE 0 END;
$$;

CREATE OR REPLACE FUNCTION public.save_wake_plan(_slot text, _tone text, _mode text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _id uuid;
  _time text;
  _challenge text := CASE WHEN _mode IN ('math','science','physics') THEN _mode ELSE 'math' END;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF public.wake_slot_reward(_slot) = 0 THEN RAISE EXCEPTION 'invalid wake slot'; END IF;
  _time := CASE upper(trim(_slot))
    WHEN '4AM' THEN '04:00' WHEN '5AM' THEN '05:00'
    WHEN '6AM' THEN '06:00' ELSE '07:00' END;

  SELECT a.id INTO _id FROM public.alarms a
    WHERE a.user_id = _uid AND a.label = 'AXEN Wake Protocol' LIMIT 1;

  IF _id IS NULL THEN
    INSERT INTO public.alarms(user_id, time, label, tone, days, challenge_type, is_active)
    VALUES (_uid, _time, 'AXEN Wake Protocol', coalesce(_tone,'superloud'), '{0,1,2,3,4,5,6}', _challenge, true)
    RETURNING id INTO _id;
  ELSE
    UPDATE public.alarms
      SET time = _time, tone = coalesce(_tone,'superloud'), challenge_type = _challenge,
          is_active = true, updated_at = now()
      WHERE id = _id;
  END IF;

  RETURN _id;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_wake_protocol(_slot text, _task_id uuid DEFAULT NULL)
RETURNS TABLE(coins integer, streak integer, longest_streak integer, awarded integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _today date := (now() AT TIME ZONE 'utc')::date;
  _reward integer := public.wake_slot_reward(_slot);
  _alarm uuid;
  _inserted boolean := false;
  _last date;
  _new_streak integer;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _reward = 0 THEN RAISE EXCEPTION 'invalid wake slot'; END IF;
  PERFORM set_config('app.economy_write', 'on', true);

  _alarm := public.save_wake_plan(_slot, NULL, 'math');

  INSERT INTO public.alarm_sessions(user_id, alarm_id, completed_on, coins_awarded)
  VALUES (_uid, _alarm, _today, _reward)
  ON CONFLICT (user_id, alarm_id, completed_on) DO NOTHING;
  GET DIAGNOSTICS _inserted = ROW_COUNT;

  IF _inserted THEN
    SELECT p.last_activity_date INTO _last FROM public.profiles p WHERE p.id = _uid;
    IF _last = _today THEN
      SELECT p.streak INTO _new_streak FROM public.profiles p WHERE p.id = _uid;
    ELSIF _last = _today - 1 THEN
      SELECT p.streak + 1 INTO _new_streak FROM public.profiles p WHERE p.id = _uid;
    ELSE
      _new_streak := 1;
    END IF;

    UPDATE public.profiles p
      SET coins = p.coins + _reward,
          streak = _new_streak,
          longest_streak = GREATEST(p.longest_streak, _new_streak),
          last_activity_date = _today
      WHERE p.id = _uid;

    INSERT INTO public.coin_transactions(user_id, amount, reason, ref_id)
    VALUES (_uid, _reward, 'wake', _alarm);
  END IF;

  IF _task_id IS NOT NULL THEN
    INSERT INTO public.task_completions(user_id, task_id, completed_on, coins_awarded)
    SELECT _uid, t.id, _today, 0 FROM public.tasks t
      WHERE t.id = _task_id AND t.user_id = _uid AND t.is_active
    ON CONFLICT (user_id, task_id, completed_on) DO NOTHING;
  END IF;

  SELECT p.coins, p.streak, p.longest_streak
    INTO coins, streak, longest_streak
    FROM public.profiles p WHERE p.id = _uid;
  awarded := CASE WHEN _inserted THEN _reward ELSE 0 END;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_zen_session(_minutes integer)
RETURNS TABLE(coins integer, awarded integer, minutes integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _mins integer := LEAST(GREATEST(coalesce(_minutes, 0), 0), 60);
  _pts integer;
  _last timestamptz;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _mins < 5 THEN RAISE EXCEPTION 'session too short'; END IF;

  SELECT max(fs.created_at) INTO _last FROM public.focus_sessions fs
    WHERE fs.user_id = _uid AND fs.tier = 'zen';
  IF _last IS NOT NULL AND _last > now() - (_mins || ' minutes')::interval THEN
    RAISE EXCEPTION 'zen session too soon';
  END IF;

  _pts := LEAST(12, GREATEST(2, (_mins / 5) * 2));
  PERFORM set_config('app.economy_write', 'on', true);

  INSERT INTO public.focus_sessions(user_id, tier, minutes, coins_awarded, lock_mode, blocked_apps)
  VALUES (_uid, 'zen', _mins, _pts, 'flex', '{}');

  UPDATE public.profiles p SET coins = p.coins + _pts WHERE p.id = _uid;
  INSERT INTO public.coin_transactions(user_id, amount, reason) VALUES (_uid, _pts, 'zen');

  SELECT p.coins INTO coins FROM public.profiles p WHERE p.id = _uid;
  awarded := _pts;
  minutes := _mins;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.save_wake_plan(text, text, text) FROM public;
REVOKE ALL ON FUNCTION public.complete_wake_protocol(text, uuid) FROM public;
REVOKE ALL ON FUNCTION public.complete_zen_session(integer) FROM public;
GRANT EXECUTE ON FUNCTION public.save_wake_plan(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_wake_protocol(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_zen_session(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.wake_slot_reward(text) TO authenticated;