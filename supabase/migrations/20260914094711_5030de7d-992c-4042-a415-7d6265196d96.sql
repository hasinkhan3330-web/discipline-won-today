ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS preferred_name text,
  ADD COLUMN IF NOT EXISTS age_range text,
  ADD COLUMN IF NOT EXISTS primary_goal text,
  ADD COLUMN IF NOT EXISTS first_habit text,
  ADD COLUMN IF NOT EXISTS social_hours_daily numeric(4,1),
  ADD COLUMN IF NOT EXISTS biggest_distraction text,
  ADD COLUMN IF NOT EXISTS wake_time time,
  ADD COLUMN IF NOT EXISTS sleep_time time,
  ADD COLUMN IF NOT EXISTS consistency_days integer,
  ADD COLUMN IF NOT EXISTS routine_breaker text,
  ADD COLUMN IF NOT EXISTS preferred_focus_time text,
  ADD COLUMN IF NOT EXISTS commitment_milestone integer,
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS onboarding_version integer NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS onboarding_step integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS safe_minor_mode boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS behavioral_tracking_allowed boolean NOT NULL DEFAULT true;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_age_range_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_age_range_check CHECK (age_range IS NULL OR age_range IN ('under_13','13_17','18_24','25_34','35_44','45_plus'));
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_social_hours_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_social_hours_check CHECK (social_hours_daily IS NULL OR (social_hours_daily >= 0 AND social_hours_daily <= 12));
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_consistency_days_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_consistency_days_check CHECK (consistency_days IS NULL OR (consistency_days >= 0 AND consistency_days <= 7));
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_commitment_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_commitment_check CHECK (commitment_milestone IS NULL OR commitment_milestone IN (21,60,90));
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_onboarding_step_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_onboarding_step_check CHECK (onboarding_step BETWEEN 1 AND 13);

ALTER TABLE public.habit_reminders
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS weekdays integer[] NOT NULL DEFAULT '{0,1,2,3,4,5,6}',
  ADD COLUMN IF NOT EXISTS repeat_mode text NOT NULL DEFAULT 'weekly',
  ADD COLUMN IF NOT EXISTS sound text NOT NULL DEFAULT 'default',
  ADD COLUMN IF NOT EXISTS vibration boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS snooze_minutes integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS notification_id integer,
  ADD COLUMN IF NOT EXISTS scheduling_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS scheduling_error text,
  ADD COLUMN IF NOT EXISTS last_scheduled_at timestamptz;
ALTER TABLE public.habit_reminders DROP CONSTRAINT IF EXISTS habit_reminders_repeat_mode_check;
ALTER TABLE public.habit_reminders ADD CONSTRAINT habit_reminders_repeat_mode_check CHECK (repeat_mode IN ('once','daily','weekdays','weekly'));
ALTER TABLE public.habit_reminders DROP CONSTRAINT IF EXISTS habit_reminders_snooze_check;
ALTER TABLE public.habit_reminders ADD CONSTRAINT habit_reminders_snooze_check CHECK (snooze_minutes IN (0,5,10,15,30));
ALTER TABLE public.habit_reminders DROP CONSTRAINT IF EXISTS habit_reminders_scheduling_status_check;
ALTER TABLE public.habit_reminders ADD CONSTRAINT habit_reminders_scheduling_status_check CHECK (scheduling_status IN ('pending','scheduled','failed','disabled'));
ALTER TABLE public.habit_reminders DROP CONSTRAINT IF EXISTS habit_reminders_weekdays_check;
ALTER TABLE public.habit_reminders ADD CONSTRAINT habit_reminders_weekdays_check CHECK (weekdays <@ ARRAY[0,1,2,3,4,5,6] AND cardinality(weekdays) > 0);
DROP POLICY IF EXISTS habit_reminders_premium_gate ON public.habit_reminders;
CREATE INDEX IF NOT EXISTS habit_reminders_user_enabled_time_idx ON public.habit_reminders(user_id, enabled, remind_at);

CREATE OR REPLACE FUNCTION public.enforce_reminder_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _count integer;
BEGIN
  IF NEW.user_id <> auth.uid() THEN RAISE EXCEPTION 'not authorized'; END IF;
  IF NEW.enabled AND NOT public.has_premium_access(NEW.user_id) THEN
    SELECT count(*) INTO _count FROM public.habit_reminders
      WHERE user_id = NEW.user_id AND enabled AND id <> NEW.id;
    IF _count >= 3 THEN RAISE EXCEPTION 'Basic includes up to 3 active reminders'; END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS enforce_reminder_limit_trigger ON public.habit_reminders;
CREATE TRIGGER enforce_reminder_limit_trigger BEFORE INSERT OR UPDATE OF enabled ON public.habit_reminders FOR EACH ROW EXECUTE FUNCTION public.enforce_reminder_limit();

CREATE TABLE public.coach_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL DEFAULT 'New conversation',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coach_conversations TO authenticated;
GRANT ALL ON public.coach_conversations TO service_role;
ALTER TABLE public.coach_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY coach_conversations_select_own ON public.coach_conversations FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY coach_conversations_insert_own ON public.coach_conversations FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY coach_conversations_update_own ON public.coach_conversations FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY coach_conversations_delete_own ON public.coach_conversations FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX coach_conversations_user_updated_idx ON public.coach_conversations(user_id, updated_at DESC);

CREATE TABLE public.coach_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.coach_conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('user','assistant')),
  content text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 4000),
  suggested_action jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.coach_messages TO authenticated;
GRANT ALL ON public.coach_messages TO service_role;
ALTER TABLE public.coach_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY coach_messages_select_own ON public.coach_messages FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY coach_messages_insert_own ON public.coach_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.coach_conversations c WHERE c.id = conversation_id AND c.user_id = auth.uid()));
CREATE POLICY coach_messages_delete_own ON public.coach_messages FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX coach_messages_conversation_created_idx ON public.coach_messages(conversation_id, created_at);

CREATE OR REPLACE FUNCTION public.touch_coach_conversation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN UPDATE public.coach_conversations SET updated_at = now() WHERE id = NEW.conversation_id AND user_id = NEW.user_id; RETURN NEW; END; $$;
CREATE TRIGGER touch_coach_conversation_after_message AFTER INSERT ON public.coach_messages FOR EACH ROW EXECUTE FUNCTION public.touch_coach_conversation();

ALTER TABLE public.alarms
  ADD COLUMN IF NOT EXISTS checkin_window_minutes integer NOT NULL DEFAULT 90,
  ADD COLUMN IF NOT EXISTS sleep_recommendation time,
  ADD COLUMN IF NOT EXISTS challenge_started_on date,
  ADD COLUMN IF NOT EXISTS recovery_enabled boolean NOT NULL DEFAULT true;
ALTER TABLE public.alarms DROP CONSTRAINT IF EXISTS alarms_checkin_window_check;
ALTER TABLE public.alarms ADD CONSTRAINT alarms_checkin_window_check CHECK (checkin_window_minutes BETWEEN 15 AND 120);

ALTER TABLE public.alarm_sessions
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'completed',
  ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS checked_in_at timestamptz,
  ADD COLUMN IF NOT EXISTS recovered boolean NOT NULL DEFAULT false;
ALTER TABLE public.alarm_sessions DROP CONSTRAINT IF EXISTS alarm_sessions_status_check;
ALTER TABLE public.alarm_sessions ADD CONSTRAINT alarm_sessions_status_check CHECK (status IN ('triggered','completed','missed','recovered'));
CREATE INDEX IF NOT EXISTS alarm_sessions_user_date_idx ON public.alarm_sessions(user_id, completed_on DESC);

ALTER TABLE public.focus_sessions
  ADD COLUMN IF NOT EXISTS session_token uuid,
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS ended_at timestamptz,
  ADD COLUMN IF NOT EXISTS intensity text;
CREATE UNIQUE INDEX IF NOT EXISTS focus_sessions_user_token_key ON public.focus_sessions(user_id, session_token) WHERE session_token IS NOT NULL;

CREATE OR REPLACE FUNCTION public.save_onboarding_step(_step integer, _answers jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _uid uuid := auth.uid(); _age text := nullif(_answers->>'age_range',''); _minor boolean;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _step < 1 OR _step > 13 THEN RAISE EXCEPTION 'invalid onboarding step'; END IF;
  _minor := _age IN ('under_13','13_17');
  UPDATE public.profiles SET
    preferred_name = left(nullif(_answers->>'preferred_name',''), 60),
    age_range = _age,
    acquisition_source = left(nullif(_answers->>'acquisition_source',''), 40),
    primary_goal = left(nullif(_answers->>'primary_goal',''), 40),
    first_habit = left(nullif(_answers->>'first_habit',''), 100),
    social_hours_daily = CASE WHEN _answers ? 'social_hours_daily' THEN LEAST(12, GREATEST(0, (_answers->>'social_hours_daily')::numeric)) ELSE NULL END,
    biggest_distraction = left(nullif(_answers->>'biggest_distraction',''), 40),
    wake_time = nullif(_answers->>'wake_time','')::time,
    sleep_time = nullif(_answers->>'sleep_time','')::time,
    consistency_days = CASE WHEN _answers ? 'consistency_days' THEN LEAST(7, GREATEST(0, (_answers->>'consistency_days')::integer)) ELSE NULL END,
    routine_breaker = left(nullif(_answers->>'routine_breaker',''), 40),
    preferred_focus_time = left(nullif(_answers->>'preferred_focus_time',''), 40),
    commitment_milestone = CASE WHEN (_answers->>'commitment_milestone')::integer IN (21,60,90) THEN (_answers->>'commitment_milestone')::integer ELSE NULL END,
    onboarding_step = _step,
    onboarding_version = 2,
    safe_minor_mode = _minor,
    behavioral_tracking_allowed = NOT _minor,
    updated_at = now()
  WHERE id = _uid;
END;
$$;

CREATE OR REPLACE FUNCTION public.activate_axen_plan(_answers jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _uid uuid := auth.uid(); _habit text := left(trim(coalesce(_answers->>'first_habit','')),100);
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  PERFORM public.save_onboarding_step(13, _answers);
  UPDATE public.profiles SET onboarded = true, onboarding_completed = true, onboarding_completed_at = coalesce(onboarding_completed_at, now()), onboarding_step = 13, updated_at = now() WHERE id = _uid;
  IF _habit <> '' AND NOT EXISTS (SELECT 1 FROM public.tasks WHERE user_id = _uid AND lower(name) = lower(_habit)) THEN
    INSERT INTO public.tasks(user_id, icon, name, pts, sort_order, frequency, duration_days)
    VALUES (_uid, '◎', _habit, 10, coalesce((SELECT max(sort_order)+1 FROM public.tasks WHERE user_id=_uid),1), 'daily', coalesce((_answers->>'commitment_milestone')::integer,21));
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_focus_music_session(_session_token uuid, _minutes integer, _intensity text)
RETURNS TABLE(coins integer, awarded integer, minutes integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _uid uuid := auth.uid(); _reward integer; _inserted boolean;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _session_token IS NULL OR _minutes NOT IN (25,45,60,90) THEN RAISE EXCEPTION 'invalid focus session'; END IF;
  _reward := CASE _minutes WHEN 25 THEN 5 WHEN 45 THEN 9 WHEN 60 THEN 12 ELSE 18 END;
  PERFORM set_config('app.economy_write','on',true);
  INSERT INTO public.focus_sessions(user_id,tier,minutes,coins_awarded,lock_mode,blocked_apps,session_token,started_at,ended_at,intensity)
  VALUES (_uid,'music',_minutes,_reward,'flex','{}',_session_token,now()-make_interval(mins=>_minutes),now(),CASE WHEN _intensity IN ('calm','steady','intense') THEN _intensity ELSE 'steady' END)
  ON CONFLICT (user_id,session_token) WHERE session_token IS NOT NULL DO NOTHING;
  GET DIAGNOSTICS _inserted = ROW_COUNT;
  IF _inserted THEN
    UPDATE public.profiles p SET coins=p.coins+_reward WHERE p.id=_uid;
    INSERT INTO public.coin_transactions(user_id,amount,reason,ref_id) VALUES (_uid,_reward,'focus_music',_session_token);
  END IF;
  SELECT p.coins INTO coins FROM public.profiles p WHERE p.id=_uid;
  awarded := CASE WHEN _inserted THEN _reward ELSE 0 END; minutes := _minutes; RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_wake_protocol(_slot text, _task_id uuid DEFAULT NULL)
RETURNS TABLE(coins integer, streak integer, longest_streak integer, awarded integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _uid uuid := auth.uid(); _today date := (now() AT TIME ZONE 'utc')::date; _reward integer := public.wake_slot_reward(_slot); _alarm uuid; _inserted boolean := false; _last date; _new_streak integer;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _reward = 0 THEN RAISE EXCEPTION 'invalid wake slot'; END IF;
  SELECT id INTO _alarm FROM public.alarms WHERE user_id=_uid AND label='AXEN Wake Protocol' AND is_active LIMIT 1;
  IF _alarm IS NULL THEN RAISE EXCEPTION 'wake protocol is not configured'; END IF;
  PERFORM set_config('app.economy_write','on',true);
  INSERT INTO public.alarm_sessions(user_id,alarm_id,completed_on,coins_awarded,status,checked_in_at)
  VALUES (_uid,_alarm,_today,_reward,'completed',now()) ON CONFLICT (user_id,alarm_id,completed_on) DO NOTHING;
  GET DIAGNOSTICS _inserted = ROW_COUNT;
  IF _inserted THEN
    SELECT last_activity_date INTO _last FROM public.profiles WHERE id=_uid;
    IF _last=_today THEN SELECT p.streak INTO _new_streak FROM public.profiles p WHERE p.id=_uid;
    ELSIF _last=_today-1 THEN SELECT p.streak+1 INTO _new_streak FROM public.profiles p WHERE p.id=_uid;
    ELSE _new_streak:=1; END IF;
    UPDATE public.profiles p SET coins=p.coins+_reward,streak=_new_streak,longest_streak=GREATEST(p.longest_streak,_new_streak),last_activity_date=_today WHERE p.id=_uid;
    INSERT INTO public.coin_transactions(user_id,amount,reason,ref_id) VALUES (_uid,_reward,'wake',_alarm);
  END IF;
  IF _task_id IS NOT NULL THEN INSERT INTO public.task_completions(user_id,task_id,completed_on,coins_awarded) SELECT _uid,t.id,_today,0 FROM public.tasks t WHERE t.id=_task_id AND t.user_id=_uid AND t.is_active ON CONFLICT (user_id,task_id,completed_on) DO NOTHING; END IF;
  SELECT p.coins,p.streak,p.longest_streak INTO coins,streak,longest_streak FROM public.profiles p WHERE p.id=_uid;
  awarded:=CASE WHEN _inserted THEN _reward ELSE 0 END; RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.save_onboarding_step(integer,jsonb) FROM public;
REVOKE ALL ON FUNCTION public.activate_axen_plan(jsonb) FROM public;
REVOKE ALL ON FUNCTION public.complete_focus_music_session(uuid,integer,text) FROM public;
GRANT EXECUTE ON FUNCTION public.save_onboarding_step(integer,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.activate_axen_plan(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_focus_music_session(uuid,integer,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_reminder_limit() TO authenticated;
GRANT EXECUTE ON FUNCTION public.touch_coach_conversation() TO authenticated;