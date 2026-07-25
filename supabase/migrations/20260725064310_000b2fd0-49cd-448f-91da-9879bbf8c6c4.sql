
CREATE OR REPLACE FUNCTION public.apply_daily_penalty()
RETURNS TABLE(coins integer, penalized boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _yesterday date := ((now() AT TIME ZONE 'utc')::date) - 1;
  _last_pen date;
  _total int;
  _done int;
  _new_coins int;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
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
END; $$;
