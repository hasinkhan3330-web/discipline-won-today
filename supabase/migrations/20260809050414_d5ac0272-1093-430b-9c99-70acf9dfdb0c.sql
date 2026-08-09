
CREATE OR REPLACE FUNCTION public.enforce_task_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _count int;
BEGIN
  SELECT count(*) INTO _count FROM public.tasks t WHERE t.user_id = NEW.user_id AND t.is_active;
  IF _count >= 12 THEN
    RAISE EXCEPTION 'task limit reached';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_task_limit_trg ON public.tasks;
CREATE TRIGGER enforce_task_limit_trg
BEFORE INSERT ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.enforce_task_limit();

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
  _inserted boolean := false;
  _daily_cap constant integer := 120;
  _awarded_today integer;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  PERFORM set_config('app.economy_write', 'on', true);

  SELECT LEAST(GREATEST(t.pts, 0), 50) INTO _pts FROM public.tasks t WHERE t.id = _task_id AND t.user_id = _uid AND t.is_active;
  IF _pts IS NULL THEN RAISE EXCEPTION 'task not found'; END IF;

  SELECT COALESCE(sum(tc.coins_awarded), 0) INTO _awarded_today
    FROM public.task_completions tc
    WHERE tc.user_id = _uid AND tc.completed_on = _today;

  _pts := LEAST(_pts, GREATEST(_daily_cap - _awarded_today, 0));

  INSERT INTO public.task_completions(user_id, task_id, completed_on, coins_awarded)
  VALUES (_uid, _task_id, _today, _pts)
  ON CONFLICT (user_id, task_id, completed_on) DO NOTHING;

  GET DIAGNOSTICS _inserted = ROW_COUNT;

  IF NOT _inserted THEN
    SELECT p.coins, p.streak, p.longest_streak INTO coins, streak, longest_streak FROM public.profiles p WHERE p.id = _uid;
    awarded := 0;
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT p.last_activity_date INTO _last FROM public.profiles p WHERE p.id = _uid;
  IF _last = _today THEN
    SELECT p.streak INTO _new_streak FROM public.profiles p WHERE p.id = _uid;
  ELSIF _last = _today - 1 THEN
    SELECT p.streak + 1 INTO _new_streak FROM public.profiles p WHERE p.id = _uid;
  ELSE
    _new_streak := 1;
  END IF;

  UPDATE public.profiles p
    SET coins = p.coins + _pts,
        streak = _new_streak,
        longest_streak = GREATEST(p.longest_streak, _new_streak),
        last_activity_date = _today
    WHERE p.id = _uid;

  IF _pts > 0 THEN
    INSERT INTO public.coin_transactions(user_id, amount, reason, ref_id)
    VALUES (_uid, _pts, 'task', _task_id);
  END IF;

  SELECT p.coins, p.streak, p.longest_streak INTO coins, streak, longest_streak FROM public.profiles p WHERE p.id = _uid;
  awarded := _pts;
  RETURN NEXT;
END; $function$;

REVOKE EXECUTE ON FUNCTION public.enforce_task_limit() FROM PUBLIC;
