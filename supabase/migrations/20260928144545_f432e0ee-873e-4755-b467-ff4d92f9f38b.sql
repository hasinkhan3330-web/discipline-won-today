CREATE OR REPLACE FUNCTION public.complete_wake_protocol(
  _slot text,
  _task_id uuid DEFAULT NULL
)
RETURNS TABLE(
  coins integer,
  streak integer,
  longest_streak integer,
  awarded integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _uid uuid := auth.uid();
  _today date := (now() AT TIME ZONE 'utc')::date;
  _reward integer;
  _alarm uuid;
  _inserted boolean := false;
  _last date;
  _new_streak integer;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _slot NOT IN ('4AM','5AM','6AM','7AM') THEN RAISE EXCEPTION 'invalid wake slot'; END IF;

  SELECT a.id INTO _alarm
  FROM public.alarms a
  WHERE a.user_id = _uid
    AND a.label = 'AXEN Wake Protocol'
    AND a.is_active
  LIMIT 1;

  IF _alarm IS NULL THEN RAISE EXCEPTION 'wake protocol is not configured'; END IF;

  _reward := LEAST(10, public.axen_daily_coin_room(_uid));
  PERFORM set_config('app.economy_write', 'on', true);

  INSERT INTO public.alarm_sessions(
    user_id, alarm_id, completed_on, coins_awarded, status, checked_in_at
  )
  VALUES (_uid, _alarm, _today, _reward, 'completed', now())
  ON CONFLICT (user_id, alarm_id, completed_on) DO NOTHING;
  GET DIAGNOSTICS _inserted = ROW_COUNT;

  IF _inserted THEN
    SELECT p.last_activity_date INTO _last
    FROM public.profiles p WHERE p.id = _uid;

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

    IF _reward > 0 THEN
      INSERT INTO public.coin_transactions(user_id, amount, reason, ref_id)
      VALUES (_uid, _reward, 'wake', _alarm);
    END IF;
  END IF;

  IF _task_id IS NOT NULL THEN
    INSERT INTO public.task_completions(user_id, task_id, completed_on, coins_awarded)
    SELECT _uid, t.id, _today, 0
    FROM public.tasks t
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

REVOKE ALL ON FUNCTION public.complete_wake_protocol(text, uuid)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_wake_protocol(text, uuid)
TO authenticated;