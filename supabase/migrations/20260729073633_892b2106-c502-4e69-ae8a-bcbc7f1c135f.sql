
-- 1) Cap task points so complete_task cannot mint unlimited coins
UPDATE public.tasks SET pts = 50 WHERE pts > 50;
ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_pts_bounds CHECK (pts >= 0 AND pts <= 50);

-- 2) Guard economy columns on profiles: only trusted RPCs may change them
CREATE OR REPLACE FUNCTION public.guard_profile_economy()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF coalesce(current_setting('app.economy_write', true), 'off') <> 'on' THEN
    NEW.coins := OLD.coins;
    NEW.streak := OLD.streak;
    NEW.longest_streak := OLD.longest_streak;
    NEW.last_activity_date := OLD.last_activity_date;
    NEW.last_penalty_date := OLD.last_penalty_date;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_profile_economy_trg ON public.profiles;
CREATE TRIGGER guard_profile_economy_trg
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_economy();

-- 3) Re-create economy RPCs so they flag legitimate writes

CREATE OR REPLACE FUNCTION public.complete_task(_task_id uuid)
 RETURNS TABLE(coins integer, streak integer, longest_streak integer, awarded integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _pts integer;
  _today date := (now() AT TIME ZONE 'utc')::date;
  _last date;
  _new_streak integer;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  PERFORM set_config('app.economy_write', 'on', true);

  SELECT LEAST(GREATEST(t.pts, 0), 50) INTO _pts FROM public.tasks t WHERE t.id = _task_id AND t.user_id = _uid AND t.is_active;
  IF _pts IS NULL THEN RAISE EXCEPTION 'task not found'; END IF;

  INSERT INTO public.task_completions(user_id, task_id, completed_on, coins_awarded)
  VALUES (_uid, _task_id, _today, _pts)
  ON CONFLICT (user_id, task_id, completed_on) DO NOTHING;

  IF NOT FOUND THEN
    SELECT p.coins, p.streak, p.longest_streak INTO coins, streak, longest_streak FROM public.profiles p WHERE p.id = _uid;
    awarded := 0;
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT last_activity_date INTO _last FROM public.profiles WHERE id = _uid;
  IF _last = _today THEN
    SELECT p.streak INTO _new_streak FROM public.profiles p WHERE p.id = _uid;
  ELSIF _last = _today - 1 THEN
    SELECT p.streak + 1 INTO _new_streak FROM public.profiles p WHERE p.id = _uid;
  ELSE
    _new_streak := 1;
  END IF;

  UPDATE public.profiles
    SET coins = coins + _pts,
        streak = _new_streak,
        longest_streak = GREATEST(longest_streak, _new_streak),
        last_activity_date = _today
    WHERE id = _uid;

  INSERT INTO public.coin_transactions(user_id, amount, reason, ref_id)
  VALUES (_uid, _pts, 'task', _task_id);

  SELECT p.coins, p.streak, p.longest_streak INTO coins, streak, longest_streak FROM public.profiles p WHERE p.id = _uid;
  awarded := _pts;
  RETURN NEXT;
END; $function$;

CREATE OR REPLACE FUNCTION public.complete_alarm(_alarm_id uuid, _reward integer DEFAULT 10)
 RETURNS TABLE(coins integer, awarded integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _today date := (now() AT TIME ZONE 'utc')::date;
  _fixed_reward constant integer := 10;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  PERFORM set_config('app.economy_write', 'on', true);

  PERFORM 1 FROM public.alarms WHERE id = _alarm_id AND user_id = _uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'alarm not found'; END IF;

  INSERT INTO public.alarm_sessions(user_id, alarm_id, completed_on, coins_awarded)
  VALUES (_uid, _alarm_id, _today, _fixed_reward)
  ON CONFLICT (user_id, alarm_id, completed_on) DO NOTHING;

  IF NOT FOUND THEN
    SELECT p.coins INTO coins FROM public.profiles p WHERE p.id = _uid;
    awarded := 0;
    RETURN NEXT;
    RETURN;
  END IF;

  UPDATE public.profiles SET coins = coins + _fixed_reward WHERE id = _uid;
  INSERT INTO public.coin_transactions(user_id, amount, reason, ref_id)
  VALUES (_uid, _fixed_reward, 'alarm', _alarm_id);

  SELECT p.coins INTO coins FROM public.profiles p WHERE p.id = _uid;
  awarded := _fixed_reward;
  RETURN NEXT;
END; $function$;

CREATE OR REPLACE FUNCTION public.apply_daily_penalty()
 RETURNS TABLE(coins integer, penalized boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _yesterday date := ((now() AT TIME ZONE 'utc')::date) - 1;
  _last_pen date;
  _total int;
  _done int;
  _new_coins int;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  PERFORM set_config('app.economy_write', 'on', true);

  SELECT last_penalty_date, p.coins INTO _last_pen, _new_coins FROM public.profiles p WHERE p.id = _uid;
  IF _last_pen IS NOT NULL AND _last_pen >= _yesterday THEN
    coins := _new_coins; penalized := false; RETURN NEXT; RETURN;
  END IF;

  SELECT count(*) INTO _total FROM public.tasks WHERE user_id = _uid AND is_active;
  IF _total = 0 THEN
    UPDATE public.profiles SET last_penalty_date = _yesterday WHERE id = _uid;
    coins := _new_coins; penalized := false; RETURN NEXT; RETURN;
  END IF;

  SELECT count(*) INTO _done FROM public.task_completions WHERE user_id = _uid AND completed_on = _yesterday;

  IF _done < _total THEN
    _new_coins := GREATEST(0, _new_coins - 3);
    UPDATE public.profiles SET coins = _new_coins, last_penalty_date = _yesterday WHERE id = _uid;
    INSERT INTO public.coin_transactions(user_id, amount, reason) VALUES (_uid, -3, 'penalty');
    coins := _new_coins; penalized := true; RETURN NEXT; RETURN;
  END IF;

  UPDATE public.profiles SET last_penalty_date = _yesterday WHERE id = _uid;
  coins := _new_coins; penalized := false; RETURN NEXT;
END; $function$;
