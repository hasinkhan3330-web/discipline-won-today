DO $$ DECLARE body text; BEGIN
SELECT pg_get_functiondef('public.wake_submit_answer(uuid,integer,text)'::regprocedure) INTO body;
IF position('wake_verified' in body)=0 THEN body:=replace(body,'INSERT INTO public.task_completions(user_id,task_id,completed_on,coins_awarded)','INSERT INTO public.score_events(user_id,points,kind,idempotency_key) VALUES(u,public.wake_slot_reward((extract(hour FROM e.wake_time))::integer::text||''AM''),''wake_verified'',''wake:''||u::text||'':''||day::text) ON CONFLICT(idempotency_key) DO NOTHING; INSERT INTO public.task_completions(user_id,task_id,completed_on,coins_awarded)'); EXECUTE body; END IF;
SELECT pg_get_functiondef('public.wake_get_state()'::regprocedure) INTO body;
body:=replace(body,'''event'',public.wake_event_payload(e.id)','''event'',public.wake_event_payload(coalesce(e.id,(SELECT id FROM public.alarm_events WHERE user_id=u AND status=''solved'' ORDER BY solved_at DESC LIMIT 1)))'); EXECUTE body;
SELECT pg_get_functiondef('public.wake_issue_question(uuid)'::regprocedure) INTO body;
body:=replace(body,'AND question_type=''math'' AND question_hash=hh','AND question_type=''math'' AND cycle=cycle_no AND question_hash=hh');
body:=replace(body,'IF tries>500 THEN','IF tries=250 THEN cycle_no:=cycle_no+1; END IF; IF tries>500 THEN');
body:=replace(body,'SELECT * INTO e FROM public.alarm_events WHERE id=eid FOR UPDATE;','SELECT * INTO e FROM public.alarm_events WHERE id=eid FOR UPDATE; PERFORM pg_advisory_xact_lock(hashtextextended(e.user_id::text,74011));'); EXECUTE body;
END; $$;
COMMENT ON FUNCTION public.wake_submit_answer(uuid,integer,text) IS 'Only private verified solves create wake sessions, task completions and idempotent existing-score-ledger XP; tests never affect rewards.';