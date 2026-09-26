CREATE OR REPLACE FUNCTION public.axen_real_best_streak(_uid uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  WITH d AS (SELECT DISTINCT completed_on FROM public.task_completions WHERE user_id = _uid),
  g AS (SELECT completed_on - (row_number() OVER (ORDER BY completed_on))::int AS grp FROM d)
  SELECT coalesce(max(c),0)::int FROM (SELECT count(*) c FROM g GROUP BY grp) x;
$$;
REVOKE ALL ON FUNCTION public.axen_real_best_streak(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.claim_streak_milestones()
 RETURNS TABLE(milestone integer, coins integer, newly_awarded boolean)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE _uid uuid := auth.uid(); _profile integer; _real integer; _best integer; m record; _ins boolean;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT GREATEST(p.longest_streak, p.streak) INTO _profile FROM public.profiles p WHERE p.id = _uid;
  _real := public.axen_real_best_streak(_uid);
  _best := LEAST(coalesce(_profile,0), _real);  -- both must reach the threshold
  FOR m IN SELECT * FROM (VALUES (7,350),(21,1050),(100,5000),(290,14500),(365,18250)) v(n,c) LOOP
    IF _best >= m.n THEN
      PERFORM set_config('app.economy_write','on',true);
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

CREATE OR REPLACE FUNCTION public.recalc_goal(_goal_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare g public.goals%rowtype; _earned integer := 0; _pct integer;
begin
  select * into g from public.goals where id = _goal_id;
  if not found then return; end if;
  if auth.uid() is not null and auth.uid() <> g.user_id then return; end if; -- owner only
  select coalesce(sum(tc.coins_awarded), 0) into _earned
    from public.task_completions tc
   where tc.user_id = g.user_id
     and tc.task_id in (select task_id from public.goal_habits where goal_id = g.id)
     and tc.completed_on >= g.started_on;
  _pct := least(100, floor(_earned::numeric * 100 / 18000)::int);
  perform set_config('axen.goal_write','on',true);
  update public.goals
     set target_coins = 18000, earned_coins = _earned,
         progress = case when completed then progress else _pct end,
         completed = case when _earned >= 18000 then true else completed end,
         completed_at = case when _earned >= 18000 and completed_at is null then now() else completed_at end,
         updated_at = now()
   where id = g.id;
end $function$;