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