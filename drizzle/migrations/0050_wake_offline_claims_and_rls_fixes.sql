CREATE TABLE public.wake_offline_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  alarm_id uuid NOT NULL,
  scheduled_for timestamptz NOT NULL,
  event_id uuid,
  solved_at timestamptz NOT NULL,
  client_now timestamptz NOT NULL,
  elapsed_ms integer NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  accepted boolean NOT NULL DEFAULT false,
  result text NOT NULL,
  awarded integer NOT NULL DEFAULT 0,
  UNIQUE (alarm_id, scheduled_for)
);
GRANT ALL ON public.wake_offline_claims TO service_role;
REVOKE ALL ON public.wake_offline_claims FROM anon, authenticated;
ALTER TABLE public.wake_offline_claims ENABLE ROW LEVEL SECURITY;

-- Private copy of wake_finalize_solve; timing is judged from the phone's solve time against the server schedule.
CREATE OR REPLACE FUNCTION public.wake_finalize_offline(_event_id uuid, _solved_at timestamptz)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
DECLARE u uuid; e public.alarm_events; a public.alarms; awarded integer:=0; result text; day date; inserted boolean;
BEGIN
  SELECT * INTO e FROM public.alarm_events WHERE id=_event_id FOR UPDATE;
  u:=e.user_id;
  UPDATE public.alarm_events SET status='solved',solved_at=_solved_at,next_push_at=NULL WHERE id=e.id;
  result:=CASE WHEN e.is_test THEN 'test_alarm' WHEN e.tier=0 THEN 'outside_reward_window'
    WHEN e.scheduled_for-e.saved_at<interval '2 hours' THEN 'saved_too_late'
    WHEN _solved_at-e.scheduled_for>interval '35 minutes' THEN 'solve_too_late' ELSE 'eligible' END;
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
      IF public.wake_slot_reward((extract(hour FROM e.wake_time))::integer::text||'AM')>0 THEN
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
REVOKE ALL ON FUNCTION public.wake_finalize_offline(uuid,timestamptz) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.wake_claim_offline(_alarm_id uuid, _scheduled_for timestamptz, _solved_at timestamptz, _client_now timestamptz, _elapsed_ms integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
DECLARE u uuid:=auth.uid(); c public.wake_offline_claims; a public.alarms; e public.alarm_events; reason text; fin jsonb; eid uuid;
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE='42501'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(u::text,74011));
  SELECT * INTO a FROM public.alarms WHERE id=_alarm_id AND user_id=u AND label='AXEN Wake Protocol';
  IF a.id IS NULL THEN RETURN jsonb_build_object('accepted',false,'result','unknown_alarm','awarded',0); END IF;
  SELECT * INTO c FROM public.wake_offline_claims WHERE alarm_id=_alarm_id AND scheduled_for=_scheduled_for;
  IF c.id IS NOT NULL THEN RETURN jsonb_build_object('accepted',c.accepted,'result',c.result,'awarded',c.awarded,'duplicate',true); END IF;

  reason:=CASE
    WHEN _client_now IS NULL OR abs(extract(epoch FROM (_client_now-now())))>300 THEN 'clock_drift'
    WHEN _scheduled_for>now() THEN 'not_yet_due'
    WHEN now()-_scheduled_for>interval '48 hours' THEN 'claim_too_late'
    WHEN _solved_at<_scheduled_for OR _solved_at-_scheduled_for>interval '35 minutes' THEN 'solve_outside_window'
    WHEN _solved_at>now()+interval '5 minutes' THEN 'clock_drift'
    WHEN _elapsed_ms IS NULL OR _elapsed_ms<0 OR _elapsed_ms>2100000 OR _solved_at-make_interval(secs=>_elapsed_ms/1000.0)<_scheduled_for-interval '2 minutes' THEN 'implausible_elapsed'
    ELSE NULL END;

  IF reason IS NULL THEN
    SELECT * INTO e FROM public.alarm_events WHERE alarm_id=a.id AND scheduled_for=_scheduled_for AND NOT is_test FOR UPDATE;
    IF e.id IS NULL THEN
      -- Firing created ahead of time is missing (e.g. the earlier firing was never solved): accept only a real scheduled firing of this alarm.
      IF NOT a.is_active OR (_scheduled_for AT TIME ZONE a.wake_timezone)::time<>a.time
         OR _scheduled_for<coalesce(a.wake_saved_at,a.created_at)
         OR (NOT a.wake_repeat_daily AND a.wake_next_fire_at IS DISTINCT FROM _scheduled_for) THEN
        reason:='not_a_firing';
      ELSE
        INSERT INTO public.alarm_events(user_id,alarm_id,scheduled_for,local_date,timezone,wake_time,saved_at,question_type,difficulty,tier,status,first_ring_at)
          VALUES(u,a.id,_scheduled_for,(_scheduled_for AT TIME ZONE a.wake_timezone)::date,a.wake_timezone,a.time,coalesce(a.wake_saved_at,a.created_at),a.challenge_type,a.wake_difficulty,public.wake_tier_coins(a.time),'ringing',_scheduled_for)
          ON CONFLICT(alarm_id,scheduled_for,is_test) DO NOTHING RETURNING id INTO eid;
        SELECT * INTO e FROM public.alarm_events WHERE id=coalesce(eid,(SELECT id FROM public.alarm_events WHERE alarm_id=a.id AND scheduled_for=_scheduled_for AND NOT is_test)) FOR UPDATE;
      END IF;
    END IF;
    IF reason IS NULL AND e.status='solved' THEN reason:='already_solved'; END IF;
    IF reason IS NULL AND e.status NOT IN ('scheduled','ringing') THEN reason:='not_a_firing'; END IF;
  END IF;

  IF reason IS NOT NULL THEN
    INSERT INTO public.wake_offline_claims(user_id,alarm_id,scheduled_for,event_id,solved_at,client_now,elapsed_ms,accepted,result,awarded)
      VALUES(u,_alarm_id,_scheduled_for,e.id,_solved_at,coalesce(_client_now,now()),coalesce(_elapsed_ms,0),false,reason,0);
    RETURN jsonb_build_object('accepted',false,'result',reason,'awarded',0);
  END IF;

  UPDATE public.alarm_events SET first_ring_at=coalesce(first_ring_at,_scheduled_for) WHERE id=e.id;
  fin:=public.wake_finalize_offline(e.id,_solved_at);
  INSERT INTO public.wake_offline_claims(user_id,alarm_id,scheduled_for,event_id,solved_at,client_now,elapsed_ms,accepted,result,awarded)
    VALUES(u,_alarm_id,_scheduled_for,e.id,_solved_at,_client_now,_elapsed_ms,true,fin->>'result',coalesce((fin->>'awarded')::integer,0));
  RETURN jsonb_build_object('accepted',true,'result',fin->>'result','awarded',coalesce((fin->>'awarded')::integer,0));
END; $function$;
REVOKE ALL ON FUNCTION public.wake_claim_offline(uuid,timestamptz,timestamptz,timestamptz,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.wake_claim_offline(uuid,timestamptz,timestamptz,timestamptz,integer) TO authenticated;

-- Part B fix 2: partner messages readable only with an active partner.
DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='partner_messages' AND cmd='SELECT' LOOP
    EXECUTE format('DROP POLICY %I ON public.partner_messages', p.policyname);
  END LOOP;
END $$;
CREATE POLICY "Partner messages readable by active partners" ON public.partner_messages FOR SELECT TO authenticated
  USING ((sender_id = auth.uid() AND public.is_active_partner(recipient_id)) OR (recipient_id = auth.uid() AND public.is_active_partner(sender_id)));

-- Part B fix 3: remove leftover signed-out privileges.
REVOKE ALL ON public.coach_memory, public.coach_plan_materialized, public.coach_plans, public.coach_profile, public.daily_coin_decay, public.nudge_templates, public.plan_tasks FROM anon;