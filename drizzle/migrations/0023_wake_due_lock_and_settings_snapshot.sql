DO $$ DECLARE body text; BEGIN
SELECT pg_get_functiondef('public.wake_save_settings(time,time,text,text,boolean,boolean,smallint)'::regprocedure) INTO body;
body:=replace(body,'SELECT reward_timezone INTO z FROM public.profiles WHERE id=u;','SELECT reward_timezone INTO z FROM public.profiles WHERE id=u; IF EXISTS(SELECT 1 FROM public.alarm_events WHERE user_id=u AND status=''scheduled'' AND scheduled_for<=now()) THEN RAISE EXCEPTION ''Your alarm is due. Solve it before changing settings''; END IF;');
body:=replace(body,'a.wake_timezone=z THEN','a.wake_timezone=z AND a.tone=_tone AND a.challenge_type=_mode AND a.wake_difficulty=_difficulty THEN'); EXECUTE body;
SELECT pg_get_functiondef('public.wake_create_occurrence(uuid)'::regprocedure) INTO body;
body:=replace(body,'SET question_type=EXCLUDED.question_type,difficulty=EXCLUDED.difficulty','SET question_type=EXCLUDED.question_type,difficulty=EXCLUDED.difficulty,saved_at=EXCLUDED.saved_at'); EXECUTE body;
SELECT pg_get_functiondef('public.wake_sweep_due(integer)'::regprocedure) INTO body;
body:=replace(body,'LOOP UPDATE public.alarm_events SET status=''ringing''','LOOP IF NOT pg_try_advisory_xact_lock(hashtextextended(e.user_id::text,74011)) THEN CONTINUE; END IF; UPDATE public.alarm_events SET status=''ringing'''); EXECUTE body;
SELECT pg_get_functiondef('public.complete_task(uuid)'::regprocedure) INTO body;
body:=replace(body,'Wake Up 4AM needs the live selfie check','Wake Up requires the server-issued alarm challenge'); EXECUTE body;
END; $$;
COMMENT ON FUNCTION public.wake_save_settings(time,time,text,text,boolean,boolean,smallint) IS 'Schedule and challenge changes reset saved-at eligibility; due or ringing events cannot be rescheduled away. Existing settings snapshots remain server-owned.';