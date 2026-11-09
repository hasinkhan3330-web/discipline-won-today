-- Rollback for 0036_wake_new_missions + 0037 (run only after switching any shake/typing/tiles alarms back to math).
DO $r$ DECLARE src text; BEGIN
  src:=pg_get_functiondef('public.wake_issue_question'::regproc);
  EXECUTE replace(src,'IF e.question_type IN (''shake'',''typing'',''tiles'') THEN PERFORM public.wake_issue_mission(eid); RETURN; END IF; ','');
  src:=pg_get_functiondef('public.wake_save_settings'::regproc);
  EXECUTE replace(src,'_mode NOT IN (''math'',''science'',''shake'',''typing'',''tiles'')','_mode NOT IN (''math'',''science'')');
END $r$;
DROP FUNCTION IF EXISTS public.wake_complete_mission(uuid,integer,jsonb);
DROP FUNCTION IF EXISTS public.wake_set_mission_options(smallint,text);
DROP FUNCTION IF EXISTS public.wake_finalize_solve(uuid);
DROP FUNCTION IF EXISTS public.wake_issue_mission(uuid);
ALTER TABLE public.alarms ADD CONSTRAINT alarms_challenge_type_check CHECK (challenge_type = ANY (ARRAY['math','physics','science','none']));
ALTER TABLE public.alarms DROP CONSTRAINT alarms_challenge_type_missions_check;
-- Optional (removes data): DROP TABLE public.wake_typing_sentences; and the added alarm/alarm_events columns.
