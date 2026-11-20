-- Rolled-back check of wake_claim_offline (raises its output, so nothing is saved). Run with the database query tool.
DO $T$
DECLARE r text := E'\n'; aid uuid; uid uuid; tm time; tz text; f timestamptz; other uuid; c0 int; c1 int; j jsonb;

BEGIN
  SELECT a.id,a.user_id,a.time,a.wake_timezone INTO aid,uid,tm,tz FROM public.alarms a WHERE a.label='AXEN Wake Protocol' AND a.is_active AND a.wake_repeat_daily ORDER BY a.created_at LIMIT 1;
  f := ((now() AT TIME ZONE tz)::date + tm) AT TIME ZONE tz;
  IF f > now() - interval '40 minutes' THEN f := (((now() AT TIME ZONE tz)::date - 1) + tm) AT TIME ZONE tz; END IF;
  UPDATE public.alarms SET wake_saved_at = f - interval '3 days' WHERE id=aid;
  SELECT id INTO other FROM public.alarms WHERE user_id<>uid LIMIT 1;
  SELECT coins INTO c0 FROM public.profiles WHERE id=uid;
  r := r || format('firing=%s local=%s tz=%s slot_coins=%s coins_before=%s', f, tm, tz, public.wake_slot_reward(extract(hour FROM tm)::int::text||'AM'), c0) || E'\n';
  PERFORM set_config('request.jwt.claim.sub', uid::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub',uid,'role','authenticated')::text, true);
  r := r || 'drift 10min: ' || public.wake_claim_offline(aid, f+interval '1 day'-interval '1 day', f+interval '5 min', now()+interval '10 min', 300000)::text || E'\n';
  DELETE FROM public.wake_offline_claims WHERE alarm_id=aid;
  r := r || 'solved 40min after: ' || public.wake_claim_offline(aid, f, f+interval '40 min', now(), 300000)::text || E'\n';
  DELETE FROM public.wake_offline_claims WHERE alarm_id=aid;
  r := r || 'solved before ring: ' || public.wake_claim_offline(aid, f, f-interval '1 min', now(), 1000)::text || E'\n';
  DELETE FROM public.wake_offline_claims WHERE alarm_id=aid;
  r := r || 'firing 50h old: ' || public.wake_claim_offline(aid, f-interval '2 days'-interval '2 hours', f-interval '2 days'-interval '2 hours'+interval '5 min', now(), 300000)::text || E'\n';
  r := r || 'wrong minute: ' || public.wake_claim_offline(aid, f+interval '7 min', f+interval '9 min', now(), 120000)::text || E'\n';
  r := r || 'other users alarm: ' || public.wake_claim_offline(other, f, f+interval '5 min', now(), 300000)::text || E'\n';
  DELETE FROM public.wake_offline_claims WHERE alarm_id=aid;
  r := r || 'VALID: ' || public.wake_claim_offline(aid, f, f+interval '5 min', now(), 300000)::text || E'\n';
  r := r || 'repeat same firing: ' || public.wake_claim_offline(aid, f, f+interval '6 min', now(), 360000)::text || E'\n';
  SELECT coins INTO c1 FROM public.profiles WHERE id=uid;
  r := r || format('coins_after=%s event=%s claim_rows=%s', c1,
     (SELECT status||'/'||coalesce(reward_result,'') FROM public.alarm_events WHERE alarm_id=aid AND scheduled_for=f),
     (SELECT count(*) FROM public.wake_offline_claims WHERE alarm_id=aid)) || E'\n';
  -- a firing already solved online
  INSERT INTO public.alarm_events(user_id,alarm_id,scheduled_for,local_date,timezone,wake_time,saved_at,question_type,difficulty,tier,status,first_ring_at,solved_at)
    VALUES(uid,aid,f-interval '1 day',((f-interval '1 day') AT TIME ZONE tz)::date,tz,tm,f-interval '3 days','math',2,1,'solved',f-interval '1 day',f-interval '1 day'+interval '3 min')
    ON CONFLICT(alarm_id,scheduled_for,is_test) DO UPDATE SET status='solved';
  r := r || 'already solved online: ' || public.wake_claim_offline(aid, f-interval '1 day', f-interval '1 day'+interval '5 min', now(), 300000)::text || E'\n';
  RAISE EXCEPTION 'TEST OUTPUT (rolled back):%', r;
END $T$;
