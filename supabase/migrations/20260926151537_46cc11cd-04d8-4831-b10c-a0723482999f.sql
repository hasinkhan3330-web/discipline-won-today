CREATE OR REPLACE FUNCTION public.claim_streak_milestones()
 RETURNS TABLE(milestone integer, coins integer, newly_awarded boolean)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _uid uuid := auth.uid(); _best integer; m record; _ins boolean;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT GREATEST(p.longest_streak, p.streak) INTO _best FROM public.profiles p WHERE p.id = _uid;
  PERFORM set_config('app.economy_write','on',true);
  FOR m IN SELECT * FROM (VALUES (7,350),(21,1050),(100,5000),(290,14500),(365,18250)) v(n,c) LOOP
    IF coalesce(_best,0) >= m.n THEN
      INSERT INTO public.unlock_rewards(user_id, reward_key, metadata)
      VALUES (_uid, 'streak_' || m.n, jsonb_build_object('coins', m.c))
      ON CONFLICT (user_id, reward_key) DO NOTHING;
      GET DIAGNOSTICS _ins = ROW_COUNT;
      IF _ins THEN
        UPDATE public.profiles p SET coins = p.coins + m.c WHERE p.id = _uid;
        INSERT INTO public.coin_transactions(user_id, amount, reason) VALUES (_uid, m.c, 'streak_milestone');
      END IF;
      milestone := m.n; coins := m.c; newly_awarded := _ins; RETURN NEXT;
    END IF;
  END LOOP;
END; $function$;
REVOKE ALL ON FUNCTION public.claim_streak_milestones() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_streak_milestones() TO authenticated;