CREATE OR REPLACE FUNCTION public.wake_finalize_offline(_event_id uuid, _solved_at timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE u uuid; e public.alarm_events; a public.alarms; awarded integer:=0; result text; day date; inserted boolean;
BEGIN
  SELECT * INTO e FROM public.alarm_events WHERE id=_event_id FOR UPDATE;
  u:=e.user_id;
  UPDATE public.alarm_events SET status='solved',solved_at=_solved_at,next_push_at=NULL WHERE id=e.id;
  result:=CASE WHEN e.is_test THEN 'test_alarm' WHEN e.tier=0 THEN 'outside_reward_window'
    WHEN e.scheduled_for-e.saved_at<interval '2 hours' THEN 'saved_too_late'
    WHEN _solved_at-e.scheduled_for>interval '35 minutes' THEN 'solve_too_late' WHEN now()>=((e.local_date+time '07:30') AT TIME ZONE e.timezone) THEN 'after_cutoff' ELSE 'eligible' END;
  IF result='eligible' THEN
    awarded:=public.axen_award_completion_coins(u,'wake',e.id);
    result:=CASE WHEN awarded>0 THEN 'awarded' ELSE 'daily_claimed' END;
  END IF;
  SELECT * INTO a FROM public.alarms WHERE id=e.alarm_id FOR UPDATE;
  day:=public.axen_reward_local_day(u);
  IF NOT e.is_test THEN
    PERFORM set_config('app.economy_write','on',true);
    PERFORM set_config('axen.contract_write','on',true);
    INSERT INTO public.alarm_sessions(user_id,alarm_id,completed_on,coins_awarded,status,checked_in_at)
      VALUES(u,a.id,day,awarded,'completed',now()) ON CONFLICT(user_id,alarm_id,completed_on) DO NOTHING;
    inserted:=FOUND;
    IF inserted THEN
      UPDATE public.profiles SET streak=CASE WHEN last_activity_date=day THEN streak WHEN last_activity_date=day-1 THEN streak+1 ELSE 1 END,
        longest_streak=greatest(longest_streak,CASE WHEN last_activity_date=day THEN streak WHEN last_activity_date=day-1 THEN streak+1 ELSE 1 END),
        last_activity_date=day WHERE id=u;
      IF result<>'after_cutoff' AND public.wake_slot_reward((extract(hour FROM e.wake_time))::integer::text||'AM')>0 THEN
        INSERT INTO public.score_events(user_id,points,kind,idempotency_key)
          VALUES(u,public.wake_slot_reward((extract(hour FROM e.wake_time))::integer::text||'AM'),'wake_verified','wake:'||u::text||':'||day::text)
          ON CONFLICT(idempotency_key) DO NOTHING;
      END IF;
      INSERT INTO public.task_completions(user_id,task_id,completed_on,coins_awarded)
        SELECT u,id,day,0 FROM public.tasks WHERE user_id=u AND is_active AND name~*'wake'
        ON CONFLICT(user_id,task_id,completed_on) DO NOTHING;
    END IF;
    IF a.wake_repeat_daily AND a.is_active THEN
      UPDATE public.alarms SET wake_next_fire_at=public.wake_next_fire(a.time,a.wake_timezone) WHERE id=a.id;
      PERFORM public.wake_create_occurrence(a.id);
    ELSIF a.wake_next_fire_at IS NOT NULL AND a.wake_next_fire_at<=e.scheduled_for THEN
      UPDATE public.alarms SET wake_next_fire_at=NULL,is_active=false WHERE id=a.id;
    END IF;
  END IF;
  UPDATE public.alarm_events SET coins_awarded=awarded,reward_result=result WHERE id=e.id;
  UPDATE public.wake_push_outbox SET status='cancelled' WHERE event_id=e.id AND status IN ('pending','leased');
  INSERT INTO public.wake_delivery_log(event_id,kind) VALUES(e.id,'solved');
  RETURN jsonb_build_object('awarded',awarded,'result',result);
END; $function$;

CREATE OR REPLACE FUNCTION public.wake_finalize_solve(_event_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ DECLARE u uuid; e public.alarm_events; a public.alarms; awarded integer:=0; result text; day date; inserted boolean; BEGIN SELECT * INTO e FROM public.alarm_events WHERE id=_event_id FOR UPDATE; u:=e.user_id; UPDATE public.alarm_events SET status='solved',solved_at=now(),next_push_at=NULL WHERE id=e.id; result:=CASE WHEN e.is_test THEN 'test_alarm' WHEN e.tier=0 THEN 'outside_reward_window' WHEN e.first_ring_at-e.saved_at<interval '2 hours' THEN 'saved_too_late' WHEN now()-e.first_ring_at>interval '30 minutes' THEN 'solve_too_late' WHEN now()>=((e.local_date+time '07:30') AT TIME ZONE e.timezone) THEN 'after_cutoff' ELSE 'eligible' END; IF result='eligible' THEN awarded:=public.axen_award_completion_coins(u,'wake',e.id); result:=CASE WHEN awarded>0 THEN 'awarded' ELSE 'daily_claimed' END; END IF; SELECT * INTO a FROM public.alarms WHERE id=e.alarm_id FOR UPDATE; day:=public.axen_reward_local_day(u); IF NOT e.is_test THEN PERFORM set_config('app.economy_write','on',true); PERFORM set_config('axen.contract_write','on',true); INSERT INTO public.alarm_sessions(user_id,alarm_id,completed_on,coins_awarded,status,checked_in_at) VALUES(u,a.id,day,awarded,'completed',now()) ON CONFLICT(user_id,alarm_id,completed_on) DO NOTHING; inserted:=FOUND; IF inserted THEN UPDATE public.profiles SET streak=CASE WHEN last_activity_date=day THEN streak WHEN last_activity_date=day-1 THEN streak+1 ELSE 1 END,longest_streak=greatest(longest_streak,CASE WHEN last_activity_date=day THEN streak WHEN last_activity_date=day-1 THEN streak+1 ELSE 1 END),last_activity_date=day WHERE id=u; IF result<>'after_cutoff' AND public.wake_slot_reward((extract(hour FROM e.wake_time))::integer::text||'AM')>0 THEN INSERT INTO public.score_events(user_id,points,kind,idempotency_key) VALUES(u,public.wake_slot_reward((extract(hour FROM e.wake_time))::integer::text||'AM'),'wake_verified','wake:'||u::text||':'||day::text) ON CONFLICT(idempotency_key) DO NOTHING; END IF; INSERT INTO public.task_completions(user_id,task_id,completed_on,coins_awarded) SELECT u,id,day,0 FROM public.tasks WHERE user_id=u AND is_active AND name~*'wake' ON CONFLICT(user_id,task_id,completed_on) DO NOTHING; END IF; IF a.wake_repeat_daily AND a.is_active THEN UPDATE public.alarms SET wake_next_fire_at=public.wake_next_fire(a.time,a.wake_timezone) WHERE id=a.id; PERFORM public.wake_create_occurrence(a.id); ELSE UPDATE public.alarms SET wake_next_fire_at=NULL,is_active=false WHERE id=a.id; END IF; END IF; UPDATE public.alarm_events SET coins_awarded=awarded,reward_result=result WHERE id=e.id; UPDATE public.wake_push_outbox SET status='cancelled' WHERE event_id=e.id AND status IN ('pending','leased'); INSERT INTO public.wake_delivery_log(event_id,kind) VALUES(e.id,'solved'); RETURN jsonb_build_object('solved',true,'correct',true,'awarded',awarded,'result',result,'explanation',e.question_explanation,'event',public.wake_event_payload(e.id)); END; $function$;