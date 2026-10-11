CREATE OR REPLACE FUNCTION public.axen_completion_reward_config() RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path='' AS $$ SELECT jsonb_build_object('zen_limit',1,'contract_limit',1,'zen',10,'contract',10,'top3',10); $$;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS reward_timezone text NOT NULL DEFAULT 'Asia/Kolkata';
UPDATE public.profiles p SET reward_timezone = COALESCE((SELECT c.timezone FROM public.daily_contracts c JOIN pg_timezone_names t ON t.name=c.timezone WHERE c.user_id=p.id ORDER BY c.created_at DESC LIMIT 1),(SELECT r.timezone FROM public.habit_reminders r JOIN pg_timezone_names t ON t.name=r.timezone WHERE r.user_id=p.id ORDER BY r.created_at DESC LIMIT 1),'Asia/Kolkata');
CREATE OR REPLACE FUNCTION public.guard_reward_timezone() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ BEGIN IF TG_OP='UPDATE' AND current_user IN ('authenticated','anon') THEN NEW.reward_timezone:=OLD.reward_timezone; END IF; IF NOT EXISTS(SELECT 1 FROM pg_timezone_names WHERE name=NEW.reward_timezone) THEN RAISE EXCEPTION 'invalid stored timezone'; END IF; RETURN NEW; END; $$;
CREATE TRIGGER guard_reward_timezone BEFORE INSERT OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.guard_reward_timezone();
ALTER TABLE public.coin_transactions ADD COLUMN IF NOT EXISTS reward_source text;
ALTER TABLE public.coin_transactions ADD COLUMN IF NOT EXISTS reward_local_date date;
ALTER TABLE public.coin_transactions ADD COLUMN IF NOT EXISTS reward_key text;
ALTER TABLE public.coin_transactions ADD COLUMN IF NOT EXISTS reward_timezone text;
CREATE UNIQUE INDEX coin_completion_daily_unique ON public.coin_transactions(user_id,reward_source,reward_local_date,reward_key) WHERE reward_source IS NOT NULL;
CREATE UNIQUE INDEX coin_completion_source_unique ON public.coin_transactions(user_id,reward_source,ref_id) WHERE reward_source IS NOT NULL AND ref_id IS NOT NULL;
ALTER TABLE public.focus_sessions ADD COLUMN IF NOT EXISTS duration_seconds integer;
ALTER TABLE public.focus_sessions ADD COLUMN IF NOT EXISTS reward_lifecycle text;
ALTER TABLE public.focus_sessions ADD COLUMN IF NOT EXISTS reward_active_seconds double precision NOT NULL DEFAULT 0;
ALTER TABLE public.focus_sessions ADD COLUMN IF NOT EXISTS reward_ping_at timestamptz;
CREATE OR REPLACE FUNCTION public.axen_reward_local_day(_uid uuid) RETURNS date LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT (now() AT TIME ZONE COALESCE((SELECT reward_timezone FROM public.profiles WHERE id=_uid),'Asia/Kolkata'))::date; $$;
REVOKE ALL ON FUNCTION public.axen_reward_local_day(uuid) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.get_daily_coin_rewards() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=auth.uid(); d date; z text; BEGIN
IF u IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE='42501'; END IF;
SELECT reward_timezone INTO z FROM public.profiles WHERE id=u; d:=public.axen_reward_local_day(u);
RETURN jsonb_build_object('local_date',d,'zen_claimed',EXISTS(SELECT 1 FROM public.coin_transactions t WHERE t.user_id=u AND t.amount>0 AND (t.reward_source='zen' OR (t.reward_source IS NULL AND t.reason='zen')) AND (t.created_at AT TIME ZONE z)::date=d),'contract_claimed',EXISTS(SELECT 1 FROM public.coin_transactions t LEFT JOIN public.daily_contracts c ON c.id=t.ref_id WHERE t.user_id=u AND t.amount>0 AND (t.reward_source='contract' OR (t.reward_source IS NULL AND t.reason='contract_reward' AND NOT c.is_recovery)) AND (t.created_at AT TIME ZONE z)::date=d)); END; $$;
REVOKE ALL ON FUNCTION public.get_daily_coin_rewards() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_daily_coin_rewards() TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.axen_award_completion_coins(_uid uuid,_source text,_id uuid,_slot smallint DEFAULT NULL) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE d date; z text; co integer; k text; cfg jsonb:=public.axen_completion_reward_config(); claims jsonb; BEGIN
PERFORM pg_advisory_xact_lock(hashtextextended(_uid::text,74010));
PERFORM 1 FROM public.profiles WHERE id=_uid FOR UPDATE;
SELECT reward_timezone INTO z FROM public.profiles WHERE id=_uid; d:=public.axen_reward_local_day(_uid);
IF _source NOT IN ('zen','contract','top3') OR _id IS NULL THEN RAISE EXCEPTION 'invalid source'; END IF;
IF _source='top3' AND (_slot IS NULL OR _slot NOT BETWEEN 1 AND 3) THEN RAISE EXCEPTION 'invalid slot'; END IF;
claims:=public.get_daily_coin_rewards();
IF (_source='zen' AND (claims->>'zen_claimed')::boolean AND (cfg->>'zen_limit')::integer=1) OR (_source='contract' AND (claims->>'contract_claimed')::boolean AND (cfg->>'contract_limit')::integer=1) THEN RETURN 0; END IF;
co:=(cfg->>_source)::integer; k:=CASE WHEN _source='top3' THEN _slot::text ELSE 'daily' END;
PERFORM set_config('app.economy_write','on',true); PERFORM set_config('axen.contract_write','on',true);
INSERT INTO public.coin_transactions(user_id,amount,reason,ref_id,reward_source,reward_local_date,reward_key,reward_timezone) VALUES(_uid,co,CASE _source WHEN 'contract' THEN 'contract_reward' ELSE _source END,_id,_source,d,k,z) ON CONFLICT DO NOTHING;
IF NOT FOUND THEN RETURN 0; END IF;
UPDATE public.profiles SET coins=coins+co WHERE id=_uid; RETURN co; END; $$;
REVOKE ALL ON FUNCTION public.axen_award_completion_coins(uuid,text,uuid,smallint) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.start_zen_reward_session(_duration_seconds integer) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=auth.uid(); sid uuid; BEGIN
IF u IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE='42501'; END IF;
IF _duration_seconds NOT IN (300,600,900,1200) THEN RAISE EXCEPTION 'invalid duration'; END IF;
PERFORM pg_advisory_xact_lock(hashtextextended(u::text,74010));
PERFORM set_config('axen.contract_write','on',true);
UPDATE public.focus_sessions SET reward_lifecycle='cancelled' WHERE user_id=u AND tier='zen' AND reward_lifecycle IN ('running','paused');
INSERT INTO public.focus_sessions(user_id,tier,minutes,coins_awarded,lock_mode,blocked_apps,started_at,duration_seconds,reward_lifecycle,reward_ping_at) VALUES(u,'zen',_duration_seconds/60,0,'flex','{}',now(),_duration_seconds,'running',now()) RETURNING id INTO sid;
RETURN sid; END; $$;
CREATE OR REPLACE FUNCTION public.zen_reward_progress(_session_id uuid,_action text DEFAULT 'ping') RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=auth.uid(); s public.focus_sessions; dt double precision; BEGIN
IF u IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE='42501'; END IF;
IF _action NOT IN ('ping','pause','resume','cancel') THEN RAISE EXCEPTION 'invalid action'; END IF;
PERFORM set_config('axen.contract_write','on',true);
SELECT * INTO s FROM public.focus_sessions WHERE id=_session_id AND user_id=u AND tier='zen' AND duration_seconds IS NOT NULL FOR UPDATE;
IF NOT FOUND THEN RAISE EXCEPTION 'session not found' USING ERRCODE='42501'; END IF;
IF s.reward_lifecycle IN ('completed','cancelled') THEN RETURN s.reward_lifecycle; END IF;
dt:=extract(epoch FROM now()-s.reward_ping_at);
IF dt>45 OR _action='cancel' THEN UPDATE public.focus_sessions SET reward_lifecycle='cancelled' WHERE id=s.id; RETURN 'cancelled'; END IF;
UPDATE public.focus_sessions SET reward_active_seconds=s.reward_active_seconds+CASE WHEN s.reward_lifecycle='running' THEN GREATEST(dt,0) ELSE 0 END,reward_ping_at=now(),reward_lifecycle=CASE _action WHEN 'pause' THEN 'paused' WHEN 'resume' THEN 'running' ELSE s.reward_lifecycle END WHERE id=s.id;
RETURN CASE _action WHEN 'pause' THEN 'paused' WHEN 'resume' THEN 'running' ELSE s.reward_lifecycle END; END; $$;
CREATE OR REPLACE FUNCTION public.complete_zen_session(_session_id uuid) RETURNS TABLE(coins integer,awarded integer,minutes integer,result text) LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=auth.uid(); s public.focus_sessions; lifecycle text; BEGIN
IF u IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE='42501'; END IF;
PERFORM pg_advisory_xact_lock(hashtextextended(u::text,74010));
lifecycle:=public.zen_reward_progress(_session_id,'ping');
SELECT * INTO s FROM public.focus_sessions WHERE id=_session_id AND user_id=u FOR UPDATE;
SELECT p.coins INTO coins FROM public.profiles p WHERE p.id=u;
minutes:=s.minutes; awarded:=0;
IF lifecycle='completed' THEN result:='already_completed'; RETURN NEXT; RETURN; END IF;
IF lifecycle<>'running' OR now()-s.started_at < make_interval(secs=>s.duration_seconds-2) OR s.reward_active_seconds<s.duration_seconds-2 THEN result:='not_eligible'; RETURN NEXT; RETURN; END IF;
awarded:=public.axen_award_completion_coins(u,'zen',s.id);
UPDATE public.focus_sessions SET reward_lifecycle='completed',ended_at=now(),coins_awarded=awarded WHERE id=s.id;
SELECT p.coins INTO coins FROM public.profiles p WHERE p.id=u;
result:=CASE WHEN awarded>0 THEN 'awarded' ELSE 'daily_claimed' END; RETURN NEXT; END; $$;
CREATE OR REPLACE FUNCTION public.complete_zen_session(_minutes integer) RETURNS TABLE(coins integer,awarded integer,minutes integer) LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN RAISE EXCEPTION 'Finish the full session to earn coins: a server session is required' USING ERRCODE='22023'; END; $$;
REVOKE ALL ON FUNCTION public.start_zen_reward_session(integer),public.zen_reward_progress(uuid,text),public.complete_zen_session(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.start_zen_reward_session(integer),public.zen_reward_progress(uuid,text),public.complete_zen_session(uuid) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.award_contract(_contract_id uuid) RETURNS TABLE(xp integer,coins integer,already_awarded boolean) LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE _uid uuid:=auth.uid(); _c public.daily_contracts; _xp integer; _co integer; _key text;
BEGIN
IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE='42501'; END IF;
PERFORM pg_advisory_xact_lock(hashtextextended(_uid::text,74010));
SELECT * INTO _c FROM public.daily_contracts WHERE id=_contract_id AND user_id=_uid FOR UPDATE;
IF NOT FOUND THEN RAISE EXCEPTION 'contract not found' USING ERRCODE='42501'; END IF;
IF _c.status='rewarded' THEN RETURN QUERY SELECT _c.xp_awarded,_c.coins_awarded,true; RETURN; END IF;
IF _c.status<>'verified' THEN RAISE EXCEPTION 'contract not verified' USING ERRCODE='22023'; END IF;
IF NOT EXISTS(SELECT 1 FROM public.proof_submissions p WHERE p.contract_id=_c.id AND p.user_id=_uid AND p.status='verified') THEN RAISE EXCEPTION 'no verified proof' USING ERRCODE='22023'; END IF;
IF NOT EXISTS(SELECT 1 FROM public.contract_sessions s WHERE s.contract_id=_c.id AND s.user_id=_uid AND s.session_status='completed') THEN RAISE EXCEPTION 'no completed session' USING ERRCODE='22023'; END IF;
_xp:=CASE WHEN _c.is_recovery THEN 8 ELSE 20 END;
_co:=CASE WHEN _c.is_recovery THEN LEAST(2,public.axen_daily_coin_room(_uid)) ELSE 0 END;
_key:='contract:'||_c.id::text;
PERFORM set_config('axen.contract_write','on',true); PERFORM set_config('app.economy_write','on',true);
INSERT INTO public.score_events(user_id,points,kind,idempotency_key) VALUES(_uid,_xp,CASE WHEN _c.is_recovery THEN 'contract_recovery' ELSE 'contract_verified' END,_key) ON CONFLICT(idempotency_key) DO NOTHING;
IF NOT FOUND THEN RAISE EXCEPTION 'reward ledger conflict' USING ERRCODE='23505'; END IF;
IF NOT _c.is_recovery THEN _co:=public.axen_award_completion_coins(_uid,'contract',_c.id); END IF;
IF _co>0 AND _c.is_recovery THEN INSERT INTO public.coin_transactions(user_id,amount,reason,ref_id) VALUES(_uid,_co,'contract_reward',_c.id); UPDATE public.profiles p SET coins=p.coins+_co WHERE p.id=_uid; END IF;
UPDATE public.daily_contracts SET status='rewarded',xp_awarded=_xp,coins_awarded=_co,rewarded_at=now() WHERE id=_c.id;
PERFORM public.log_contract_event(_c.id,_uid,'rewarded','verified','rewarded',jsonb_build_object('xp',_xp,'coins',_co));
RETURN QUERY SELECT _xp,_co,false; END; $$;
CREATE OR REPLACE FUNCTION public.complete_top_task(_slot smallint) RETURNS TABLE(coins integer,awarded integer,all_done boolean) LANGUAGE plpgsql SECURITY DEFINER SET search_path='public' AS $$
DECLARE _uid uuid:=auth.uid(); _today date:=public.axen_reward_local_day(_uid); _row public.daily_top_tasks; _pts integer:=0; _done_count integer; _task_id uuid;
BEGIN
IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
IF _slot NOT BETWEEN 1 AND 3 THEN RAISE EXCEPTION 'invalid slot'; END IF;
PERFORM pg_advisory_xact_lock(hashtextextended(_uid::text,74010)); PERFORM set_config('app.economy_write','on',true);
SELECT * INTO _row FROM public.daily_top_tasks WHERE user_id=_uid AND day=_today AND slot=_slot FOR UPDATE;
IF NOT FOUND THEN RAISE EXCEPTION 'task not planned'; END IF;
IF _row.done THEN awarded:=0; ELSE
_pts:=public.axen_award_completion_coins(_uid,'top3',_row.id,_slot);
UPDATE public.daily_top_tasks SET done=true,coins_awarded=_pts,updated_at=now() WHERE id=_row.id; awarded:=_pts; END IF;
SELECT count(*) INTO _done_count FROM public.daily_top_tasks WHERE user_id=_uid AND day=_today AND done;
all_done:=_done_count>=3;
IF all_done THEN SELECT t.id INTO _task_id FROM public.tasks t WHERE t.user_id=_uid AND t.is_active AND t.name='Top 3 Missions' LIMIT 1;
IF _task_id IS NOT NULL THEN INSERT INTO public.task_completions(user_id,task_id,completed_on,coins_awarded) VALUES(_uid,_task_id,_today,0) ON CONFLICT(user_id,task_id,completed_on) DO NOTHING; UPDATE public.profiles p SET last_activity_date=_today WHERE p.id=_uid; END IF; END IF;
SELECT p.coins INTO coins FROM public.profiles p WHERE p.id=_uid; RETURN NEXT; END; $$;
CREATE OR REPLACE FUNCTION public.axen_daily_coin_room(_uid uuid) RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT GREATEST(50-COALESCE(sum(ct.amount),0),0)::int FROM public.coin_transactions ct WHERE ct.user_id=_uid AND ct.amount>0 AND ct.created_at>=date_trunc('day',now() AT TIME ZONE 'utc') AT TIME ZONE 'utc' AND ct.reward_source IS NULL AND ct.reason NOT IN ('streak_milestone','referral','gift','shield_purchase'); $$;