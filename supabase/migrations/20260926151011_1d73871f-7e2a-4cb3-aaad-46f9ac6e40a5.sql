-- AXEN economy rebalance, streak milestones, goal 18k, wake selfie
CREATE OR REPLACE FUNCTION public.axen_daily_coin_room(_uid uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
  SELECT GREATEST(50 - COALESCE(sum(ct.amount),0), 0)::int
    FROM public.coin_transactions ct
   WHERE ct.user_id = _uid AND ct.amount > 0
     AND ct.created_at >= date_trunc('day', now() AT TIME ZONE 'utc') AT TIME ZONE 'utc'
     AND ct.reason NOT IN ('streak_milestone','referral','gift','shield_purchase');
$$;
REVOKE ALL ON FUNCTION public.axen_daily_coin_room(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.axen_is_priority_habit(_name text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path TO '' AS $$
  SELECT coalesce(_name,'') ~* '(wake|cold|shower|workout|gym)';
$$;

-- Habits: priority 3, custom 1-5, wake only via selfie, daily room 50
CREATE OR REPLACE FUNCTION public.complete_task(_task_id uuid)
 RETURNS TABLE(coins integer, streak integer, longest_streak integer, awarded integer)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid(); _pts integer; _name text;
  _today date := (now() AT TIME ZONE 'utc')::date;
  _last date; _new_streak integer; _inserted boolean := false;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT t.pts, t.name INTO _pts, _name FROM public.tasks t WHERE t.id = _task_id AND t.user_id = _uid AND t.is_active;
  IF _name IS NULL THEN RAISE EXCEPTION 'task not found'; END IF;
  IF _name ~* 'wake' THEN RAISE EXCEPTION 'Wake Up 4AM needs the live selfie check'; END IF;
  _pts := CASE WHEN public.axen_is_priority_habit(_name) THEN 3 ELSE LEAST(GREATEST(coalesce(_pts,2),1),5) END;
  _pts := LEAST(_pts, public.axen_daily_coin_room(_uid));
  PERFORM set_config('app.economy_write', 'on', true);

  INSERT INTO public.task_completions(user_id, task_id, completed_on, coins_awarded)
  VALUES (_uid, _task_id, _today, _pts)
  ON CONFLICT (user_id, task_id, completed_on) DO NOTHING;
  GET DIAGNOSTICS _inserted = ROW_COUNT;
  IF NOT _inserted THEN
    SELECT p.coins, p.streak, p.longest_streak INTO coins, streak, longest_streak FROM public.profiles p WHERE p.id = _uid;
    awarded := 0; RETURN NEXT; RETURN;
  END IF;

  SELECT p.last_activity_date INTO _last FROM public.profiles p WHERE p.id = _uid;
  IF _last = _today THEN SELECT p.streak INTO _new_streak FROM public.profiles p WHERE p.id = _uid;
  ELSIF _last = _today - 1 THEN SELECT p.streak + 1 INTO _new_streak FROM public.profiles p WHERE p.id = _uid;
  ELSE _new_streak := 1; END IF;

  UPDATE public.profiles p SET coins = p.coins + _pts, streak = _new_streak,
    longest_streak = GREATEST(p.longest_streak, _new_streak), last_activity_date = _today WHERE p.id = _uid;
  IF _pts > 0 THEN
    INSERT INTO public.coin_transactions(user_id, amount, reason, ref_id) VALUES (_uid, _pts, 'task', _task_id);
  END IF;
  SELECT p.coins, p.streak, p.longest_streak INTO coins, streak, longest_streak FROM public.profiles p WHERE p.id = _uid;
  awarded := _pts; RETURN NEXT;
END; $function$;

-- Wake selfie: server-only (called by the server after the live photo passes)
CREATE OR REPLACE FUNCTION public.complete_wake_selfie(_uid uuid, _tz text)
 RETURNS TABLE(coins integer, streak integer, longest_streak integer, awarded integer, result text)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _local timestamp; _task uuid; _today date := (now() AT TIME ZONE 'utc')::date;
  _pts integer; _inserted boolean; _last date; _new_streak integer;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name = _tz) THEN RAISE EXCEPTION 'invalid timezone'; END IF;
  _local := now() AT TIME ZONE _tz;
  IF _local::time < time '04:00' OR _local::time >= time '04:30' THEN
    RAISE EXCEPTION 'Wake check-in is open only from 4:00 to 4:30 AM';
  END IF;
  SELECT t.id INTO _task FROM public.tasks t WHERE t.user_id=_uid AND t.is_active AND t.name ~* 'wake' ORDER BY t.sort_order LIMIT 1;
  IF _task IS NULL THEN RAISE EXCEPTION 'wake habit not found'; END IF;
  _pts := LEAST(10, public.axen_daily_coin_room(_uid));
  PERFORM set_config('app.economy_write','on',true);
  INSERT INTO public.task_completions(user_id,task_id,completed_on,coins_awarded)
  VALUES (_uid,_task,_today,_pts) ON CONFLICT (user_id,task_id,completed_on) DO NOTHING;
  GET DIAGNOSTICS _inserted = ROW_COUNT;
  IF _inserted THEN
    SELECT p.last_activity_date INTO _last FROM public.profiles p WHERE p.id=_uid;
    IF _last=_today THEN SELECT p.streak INTO _new_streak FROM public.profiles p WHERE p.id=_uid;
    ELSIF _last=_today-1 THEN SELECT p.streak+1 INTO _new_streak FROM public.profiles p WHERE p.id=_uid;
    ELSE _new_streak:=1; END IF;
    UPDATE public.profiles p SET coins=p.coins+_pts, streak=_new_streak,
      longest_streak=GREATEST(p.longest_streak,_new_streak), last_activity_date=_today WHERE p.id=_uid;
    IF _pts > 0 THEN INSERT INTO public.coin_transactions(user_id,amount,reason,ref_id) VALUES (_uid,_pts,'wake',_task); END IF;
  END IF;
  SELECT p.coins,p.streak,p.longest_streak INTO coins,streak,longest_streak FROM public.profiles p WHERE p.id=_uid;
  awarded := CASE WHEN _inserted THEN _pts ELSE 0 END;
  result := CASE WHEN _inserted THEN 'awarded' ELSE 'already_done' END;
  RETURN NEXT;
END; $function$;
REVOKE ALL ON FUNCTION public.complete_wake_selfie(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_wake_selfie(uuid, text) TO service_role;

-- Old quiz wake path no longer credits coins or ticks
CREATE OR REPLACE FUNCTION public.complete_wake_protocol(_slot text, _task_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(coins integer, streak integer, longest_streak integer, awarded integer)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT p.coins,p.streak,p.longest_streak INTO coins,streak,longest_streak FROM public.profiles p WHERE p.id=auth.uid();
  awarded := 0; RETURN NEXT;
END; $function$;

CREATE OR REPLACE FUNCTION public.complete_alarm(_alarm_id uuid, _reward integer DEFAULT 10)
 RETURNS TABLE(coins integer, awarded integer)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _uid uuid := auth.uid(); _today date := (now() AT TIME ZONE 'utc')::date; _pts integer; _inserted boolean := false;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  PERFORM 1 FROM public.alarms a WHERE a.id = _alarm_id AND a.user_id = _uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'alarm not found'; END IF;
  _pts := LEAST(10, public.axen_daily_coin_room(_uid));
  PERFORM set_config('app.economy_write', 'on', true);
  INSERT INTO public.alarm_sessions(user_id, alarm_id, completed_on, coins_awarded)
  VALUES (_uid, _alarm_id, _today, _pts) ON CONFLICT (user_id, alarm_id, completed_on) DO NOTHING;
  GET DIAGNOSTICS _inserted = ROW_COUNT;
  IF _inserted AND _pts > 0 THEN
    UPDATE public.profiles p SET coins = p.coins + _pts WHERE p.id = _uid;
    INSERT INTO public.coin_transactions(user_id, amount, reason, ref_id) VALUES (_uid, _pts, 'alarm', _alarm_id);
  END IF;
  SELECT p.coins INTO coins FROM public.profiles p WHERE p.id = _uid;
  awarded := CASE WHEN _inserted THEN _pts ELSE 0 END; RETURN NEXT;
END; $function$;

-- Focus music: no coins
CREATE OR REPLACE FUNCTION public.complete_focus_music_session(_session_token uuid, _minutes integer, _intensity text)
 RETURNS TABLE(coins integer, awarded integer, minutes integer)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _session_token IS NULL OR _minutes NOT IN (25,45,60,90) THEN RAISE EXCEPTION 'invalid focus session'; END IF;
  PERFORM set_config('app.economy_write','on',true);
  INSERT INTO public.focus_sessions(user_id,tier,minutes,coins_awarded,lock_mode,blocked_apps,session_token,started_at,ended_at,intensity)
  VALUES (_uid,'music',_minutes,0,'flex','{}',_session_token,now()-make_interval(mins=>_minutes),now(),CASE WHEN _intensity IN ('calm','steady','intense') THEN _intensity ELSE 'steady' END)
  ON CONFLICT (user_id,session_token) WHERE session_token IS NOT NULL DO NOTHING;
  SELECT p.coins INTO coins FROM public.profiles p WHERE p.id=_uid;
  awarded := 0; minutes := _minutes; RETURN NEXT;
END; $function$;

-- Deep Focus 49m=10, 2h=10, 3h=15
CREATE OR REPLACE FUNCTION public.complete_focus_session(_tier text, _lock_mode text DEFAULT 'strict'::text, _blocked_apps text[] DEFAULT '{}'::text[])
 RETURNS TABLE(coins integer, awarded integer, minutes integer)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _uid uuid := auth.uid(); _pts integer; _mins integer; _last timestamptz; _paid boolean;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT EXISTS (SELECT 1 FROM public.subscriptions s WHERE s.user_id = _uid AND (
    (s.status IN ('active','trialing','past_due') AND (s.current_period_end IS NULL OR s.current_period_end > now()))
    OR (s.status = 'canceled' AND s.current_period_end > now()))) INTO _paid;
  IF NOT _paid THEN RAISE EXCEPTION 'AXEN Pro subscription required'; END IF;
  IF _tier = 'f49' THEN _pts := 10; _mins := 49;
  ELSIF _tier = 'f120' THEN _pts := 10; _mins := 120;
  ELSIF _tier = 'f229' THEN _pts := 15; _mins := 180;
  ELSE RAISE EXCEPTION 'invalid tier'; END IF;
  SELECT max(fs.created_at) INTO _last FROM public.focus_sessions fs WHERE fs.user_id = _uid;
  IF _last IS NOT NULL AND _last > now() - (_mins || ' minutes')::interval THEN RAISE EXCEPTION 'focus session too soon'; END IF;
  _pts := LEAST(_pts, public.axen_daily_coin_room(_uid));
  PERFORM set_config('app.economy_write', 'on', true);
  INSERT INTO public.focus_sessions(user_id, tier, minutes, coins_awarded, lock_mode, blocked_apps)
  VALUES (_uid, _tier, _mins, _pts, coalesce(_lock_mode, 'strict'), coalesce(_blocked_apps, '{}'));
  IF _pts > 0 THEN
    UPDATE public.profiles p SET coins = p.coins + _pts WHERE p.id = _uid;
    INSERT INTO public.coin_transactions(user_id, amount, reason) VALUES (_uid, _pts, 'focus');
  END IF;
  SELECT p.coins INTO coins FROM public.profiles p WHERE p.id = _uid;
  awarded := _pts; minutes := _mins; RETURN NEXT;
END; $function$;

CREATE OR REPLACE FUNCTION public.complete_zen_session(_minutes integer)
 RETURNS TABLE(coins integer, awarded integer, minutes integer)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _uid uuid := auth.uid(); _mins integer := LEAST(GREATEST(coalesce(_minutes, 0), 0), 60); _pts integer; _last timestamptz;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _mins < 5 THEN RAISE EXCEPTION 'session too short'; END IF;
  SELECT max(fs.created_at) INTO _last FROM public.focus_sessions fs WHERE fs.user_id = _uid AND fs.tier = 'zen';
  IF _last IS NOT NULL AND _last > now() - (_mins || ' minutes')::interval THEN RAISE EXCEPTION 'zen session too soon'; END IF;
  _pts := LEAST(5, public.axen_daily_coin_room(_uid));
  PERFORM set_config('app.economy_write', 'on', true);
  INSERT INTO public.focus_sessions(user_id, tier, minutes, coins_awarded, lock_mode, blocked_apps) VALUES (_uid, 'zen', _mins, _pts, 'flex', '{}');
  IF _pts > 0 THEN
    UPDATE public.profiles p SET coins = p.coins + _pts WHERE p.id = _uid;
    INSERT INTO public.coin_transactions(user_id, amount, reason) VALUES (_uid, _pts, 'zen');
  END IF;
  SELECT p.coins INTO coins FROM public.profiles p WHERE p.id = _uid;
  awarded := _pts; minutes := _mins; RETURN NEXT;
END; $function$;

CREATE OR REPLACE FUNCTION public.complete_top_task(_slot smallint)
 RETURNS TABLE(coins integer, awarded integer, all_done boolean)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _uid uuid := auth.uid(); _today date := (now() AT TIME ZONE 'utc')::date;
  _row public.daily_top_tasks%ROWTYPE; _pts integer; _done_count integer; _task_id uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _slot NOT BETWEEN 1 AND 3 THEN RAISE EXCEPTION 'invalid slot'; END IF;
  PERFORM set_config('app.economy_write', 'on', true);
  SELECT * INTO _row FROM public.daily_top_tasks WHERE user_id = _uid AND day = _today AND slot = _slot FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'task not planned'; END IF;
  _pts := LEAST(CASE WHEN _slot = 3 THEN 6 ELSE 7 END, public.axen_daily_coin_room(_uid));
  IF _row.done THEN awarded := 0;
  ELSE
    UPDATE public.daily_top_tasks SET done = true, coins_awarded = _pts, updated_at = now() WHERE id = _row.id;
    IF _pts > 0 THEN
      UPDATE public.profiles p SET coins = p.coins + _pts WHERE p.id = _uid;
      INSERT INTO public.coin_transactions(user_id, amount, reason, ref_id) VALUES (_uid, _pts, 'top3', _row.id);
    END IF;
    awarded := _pts;
  END IF;
  SELECT count(*) INTO _done_count FROM public.daily_top_tasks WHERE user_id = _uid AND day = _today AND done;
  all_done := _done_count >= 3;
  IF all_done THEN
    SELECT t.id INTO _task_id FROM public.tasks t WHERE t.user_id = _uid AND t.is_active AND t.name = 'Top 3 Missions' LIMIT 1;
    IF _task_id IS NOT NULL THEN
      INSERT INTO public.task_completions(user_id, task_id, completed_on, coins_awarded) VALUES (_uid, _task_id, _today, 0)
      ON CONFLICT (user_id, task_id, completed_on) DO NOTHING;
      UPDATE public.profiles p SET last_activity_date = _today WHERE p.id = _uid;
    END IF;
  END IF;
  SELECT p.coins INTO coins FROM public.profiles p WHERE p.id = _uid;
  RETURN NEXT;
END; $function$;

-- Contract: 20 coins (recovery 2), within daily room; XP unchanged
CREATE OR REPLACE FUNCTION public.award_contract(_contract_id uuid)
  RETURNS TABLE(xp integer, coins integer, already_awarded boolean)
  LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE _uid uuid := auth.uid(); _c public.daily_contracts; _xp integer; _co integer; _key text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501'; END IF;
  SELECT * INTO _c FROM public.daily_contracts WHERE id = _contract_id AND user_id = _uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'contract not found' USING ERRCODE = '42501'; END IF;
  IF _c.status = 'rewarded' THEN RETURN QUERY SELECT _c.xp_awarded, _c.coins_awarded, true; RETURN; END IF;
  IF _c.status <> 'verified' THEN RAISE EXCEPTION 'contract not verified' USING ERRCODE = '22023'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.proof_submissions p WHERE p.contract_id = _c.id AND p.user_id = _uid AND p.status = 'verified') THEN
    RAISE EXCEPTION 'no verified proof' USING ERRCODE = '22023'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.contract_sessions s WHERE s.contract_id = _c.id AND s.user_id = _uid AND s.session_status = 'completed') THEN
    RAISE EXCEPTION 'no completed session' USING ERRCODE = '22023'; END IF;
  _xp := CASE WHEN _c.is_recovery THEN 8 ELSE 20 END;
  _co := LEAST(CASE WHEN _c.is_recovery THEN 2 ELSE 20 END, public.axen_daily_coin_room(_uid));
  _key := 'contract:' || _c.id::text;
  PERFORM pg_catalog.set_config('axen.contract_write', 'on', true);
  PERFORM pg_catalog.set_config('app.economy_write', 'on', true);
  INSERT INTO public.score_events(user_id, points, kind, idempotency_key)
  VALUES (_uid, _xp, CASE WHEN _c.is_recovery THEN 'contract_recovery' ELSE 'contract_verified' END, _key)
  ON CONFLICT (idempotency_key) DO NOTHING;
  IF NOT FOUND THEN RAISE EXCEPTION 'reward ledger conflict' USING ERRCODE = '23505'; END IF;
  IF _co > 0 THEN
    INSERT INTO public.coin_transactions(user_id, amount, reason, ref_id) VALUES (_uid, _co, 'contract_reward', _c.id);
    UPDATE public.profiles AS p SET coins = p.coins + _co WHERE p.id = _uid;
  END IF;
  UPDATE public.daily_contracts SET status = 'rewarded', xp_awarded = _xp, coins_awarded = _co, rewarded_at = now() WHERE id = _c.id;
  PERFORM public.log_contract_event(_c.id, _uid, 'rewarded', 'verified', 'rewarded', pg_catalog.jsonb_build_object('xp', _xp, 'coins', _co));
  RETURN QUERY SELECT _xp, _co, false;
END; $function$;

-- Streak milestones: one-time bonus per milestone
CREATE OR REPLACE FUNCTION public.claim_streak_milestones()
 RETURNS TABLE(milestone integer, coins integer, newly_awarded boolean)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _uid uuid := auth.uid(); _best integer; m record; _ins boolean;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT GREATEST(p.longest_streak, p.streak) INTO _best FROM public.profiles p WHERE p.id = _uid;
  FOR m IN SELECT * FROM (VALUES (7,350),(21,1050),(100,5000),(290,14500),(365,18250)) v(n,c) LOOP
    IF coalesce(_best,0) >= m.n THEN
      INSERT INTO public.unlock_rewards(user_id, reward_key, metadata)
      VALUES (_uid, 'streak_' || m.n, jsonb_build_object('coins', m.c))
      ON CONFLICT (user_id, reward_key) DO NOTHING;
      GET DIAGNOSTICS _ins = ROW_COUNT;
      IF _ins THEN
        PERFORM set_config('app.economy_write','on',true);
        UPDATE public.profiles p SET coins = p.coins + m.c WHERE p.id = _uid;
        INSERT INTO public.coin_transactions(user_id, amount, reason) VALUES (_uid, m.c, 'streak_milestone');
      END IF;
      milestone := m.n; coins := m.c; newly_awarded := _ins; RETURN NEXT;
    END IF;
  END LOOP;
END; $function$;
REVOKE ALL ON FUNCTION public.claim_streak_milestones() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_streak_milestones() TO authenticated;

-- Stop clients from self-inserting streak_* unlock rows
CREATE OR REPLACE FUNCTION public.guard_streak_unlocks()
RETURNS trigger LANGUAGE plpgsql SET search_path TO '' AS $$
BEGIN
  IF NEW.reward_key LIKE 'streak\_%' AND coalesce(current_setting('app.economy_write', true),'') <> 'on' THEN
    RAISE EXCEPTION 'streak rewards are server-only';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS guard_streak_unlocks ON public.unlock_rewards;
CREATE TRIGGER guard_streak_unlocks BEFORE INSERT OR UPDATE ON public.unlock_rewards FOR EACH ROW EXECUTE FUNCTION public.guard_streak_unlocks();

-- Goals: fixed 18,000 target, linked-habit coins only
CREATE OR REPLACE FUNCTION public.recalc_goal(_goal_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare g public.goals%rowtype; _earned integer := 0; _pct integer;
begin
  select * into g from public.goals where id = _goal_id;
  if not found then return; end if;
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

CREATE OR REPLACE FUNCTION public.guard_goal_coins()
RETURNS trigger LANGUAGE plpgsql SET search_path TO '' AS $$
BEGIN
  IF coalesce(current_setting('axen.goal_write', true),'') <> 'on' THEN
    IF TG_OP = 'INSERT' THEN NEW.earned_coins := 0; NEW.target_coins := 18000;
    ELSE NEW.earned_coins := OLD.earned_coins; NEW.target_coins := OLD.target_coins; END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS guard_goal_coins ON public.goals;
CREATE TRIGGER guard_goal_coins BEFORE INSERT OR UPDATE ON public.goals FOR EACH ROW EXECUTE FUNCTION public.guard_goal_coins();

DO $$ DECLARE r record; BEGIN FOR r IN SELECT id FROM public.goals LOOP PERFORM public.recalc_goal(r.id); END LOOP; END $$;

-- Custom habits: reward 1-5, no scan proof
CREATE OR REPLACE FUNCTION public.validate_task_builder_fields()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.frequency NOT IN ('daily', 'weekdays', 'weekends', 'weekly') THEN RAISE EXCEPTION 'invalid habit frequency'; END IF;
  IF NEW.duration_days < 1 OR NEW.duration_days > 365 THEN RAISE EXCEPTION 'habit duration must be between 1 and 365 days'; END IF;
  IF NOT public.axen_is_priority_habit(NEW.name) THEN
    NEW.pts := LEAST(GREATEST(coalesce(NEW.pts, 2), 1), 5);
  END IF;
  NEW.require_scan := false;
  NEW.scan_classes := '{}';
  RETURN NEW;
END; $function$;