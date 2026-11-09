-- Wake missions: Shake, Typing, Find Color Tiles (additive)
ALTER TABLE public.alarms ADD CONSTRAINT alarms_challenge_type_missions_check CHECK (challenge_type = ANY (ARRAY['math','physics','science','none','shake','typing','tiles']));
ALTER TABLE public.alarms DROP CONSTRAINT alarms_challenge_type_check;
ALTER TABLE public.alarms ADD COLUMN IF NOT EXISTS wake_mission_rounds smallint NOT NULL DEFAULT 1 CHECK (wake_mission_rounds BETWEEN 1 AND 3);
ALTER TABLE public.alarms ADD COLUMN IF NOT EXISTS wake_mission_lang text NOT NULL DEFAULT 'en' CHECK (wake_mission_lang IN ('en','hi'));
ALTER TABLE public.alarm_events ADD COLUMN IF NOT EXISTS mission_issued_at timestamptz;
ALTER TABLE public.alarm_events ADD COLUMN IF NOT EXISTS mission_rejections integer NOT NULL DEFAULT 0;
ALTER TABLE public.alarm_events ADD COLUMN IF NOT EXISTS mission_last_reject_at timestamptz;

CREATE TABLE IF NOT EXISTS public.wake_typing_sentences (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, lang text NOT NULL CHECK (lang IN ('en','hi')), difficulty smallint NOT NULL CHECK (difficulty BETWEEN 1 AND 3), body text NOT NULL, UNIQUE (lang,difficulty,body));
GRANT ALL ON public.wake_typing_sentences TO service_role;
ALTER TABLE public.wake_typing_sentences ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.wake_issue_mission(eid uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e public.alarm_events; a public.alarms; n integer; picked text[]:='{}'; s text; i integer; lvl smallint;
BEGIN
  SELECT * INTO e FROM public.alarm_events WHERE id=eid FOR UPDATE;
  SELECT * INTO a FROM public.alarms WHERE id=e.alarm_id;
  n:=coalesce(a.wake_mission_rounds,1); lvl:=greatest(1,least(3,coalesce(e.difficulty,2)));
  IF e.question_type='typing' THEN
    FOR i IN 1..n LOOP
      SELECT body INTO s FROM public.wake_typing_sentences t WHERE t.lang=coalesce(a.wake_mission_lang,'en') AND t.difficulty=lvl AND NOT (t.body = ANY(picked))
        AND md5(t.body) NOT IN (SELECT h.question_hash FROM public.wake_question_history h WHERE h.user_id=e.user_id AND h.question_type='typing' ORDER BY h.issued_at DESC LIMIT 5)
        ORDER BY random() LIMIT 1;
      IF s IS NULL THEN SELECT body INTO s FROM public.wake_typing_sentences t WHERE t.lang=coalesce(a.wake_mission_lang,'en') AND t.difficulty=lvl ORDER BY random() LIMIT 1; END IF;
      IF s IS NULL THEN RAISE EXCEPTION 'Typing sentences are not ready'; END IF;
      picked:=picked||s;
      INSERT INTO public.wake_question_history(user_id,question_hash,question_type,cycle) VALUES(e.user_id,md5(s),'typing',(SELECT coalesce(max(h.cycle),0)+1 FROM public.wake_question_history h WHERE h.user_id=e.user_id AND h.question_type='typing'));
    END LOOP;
  END IF;
  UPDATE public.alarm_events SET question_id=gen_random_uuid(),
    question_text=jsonb_build_object('mission',e.question_type,'difficulty',lvl,'rounds',n,'sentences',CASE WHEN e.question_type='typing' THEN to_jsonb(picked) ELSE NULL END)::text,
    question_options=NULL, question_answer=CASE WHEN e.question_type='typing' THEN array_to_string(picked,E'\n') ELSE NULL END,
    question_explanation='Mission complete.', question_hash=md5(e.question_type||eid::text), question_version=question_version+1, mission_issued_at=now()
  WHERE id=eid;
END; $$;

DO $mig$
DECLARE src text; fin text; anchor text:='SELECT * INTO e FROM public.alarm_events WHERE id=eid FOR UPDATE; ';
BEGIN
  -- Exact copies of the live definitions with one additive change each.
  src:=pg_get_functiondef('public.wake_issue_question'::regproc);
  IF position(anchor IN src)=0 THEN RAISE EXCEPTION 'wake_issue_question anchor missing'; END IF;
  EXECUTE replace(src, anchor, anchor||'IF e.question_type IN (''shake'',''typing'',''tiles'') THEN PERFORM public.wake_issue_mission(eid); RETURN; END IF; ');
  src:=pg_get_functiondef('public.wake_save_settings'::regproc);
  IF position('_mode NOT IN (''math'',''science'')' IN src)=0 THEN RAISE EXCEPTION 'wake_save_settings anchor missing'; END IF;
  EXECUTE replace(src, '_mode NOT IN (''math'',''science'')', '_mode NOT IN (''math'',''science'',''shake'',''typing'',''tiles'')');
  src:=pg_get_functiondef('public.wake_submit_answer(uuid,integer,text)'::regprocedure);
  fin:=substring(src FROM position('UPDATE public.alarm_events SET status=''solved''' IN src));
  fin:=left(fin, position('END; $function$' IN fin)-1);
  EXECUTE 'CREATE OR REPLACE FUNCTION public.wake_finalize_solve(_event_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '''' AS $function$ DECLARE u uuid; e public.alarm_events; a public.alarms; awarded integer:=0; result text; day date; inserted boolean; BEGIN SELECT * INTO e FROM public.alarm_events WHERE id=_event_id FOR UPDATE; u:=e.user_id; '||fin||'END; $function$';
END $mig$;

CREATE OR REPLACE FUNCTION public.wake_complete_mission(_event_id uuid, _version integer, _proof jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=auth.uid(); e public.alarm_events; lvl integer; rounds integer; srv numeric; cli numeric; ok boolean:=false; reason text:='implausible'; target integer; shakes integer; expected text[]; typed jsonb; chars integer:=0; i integer; taps integer; tg integer;
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE='42501'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(u::text,74010)); PERFORM pg_advisory_xact_lock(hashtextextended(u::text,74011));
  SELECT * INTO e FROM public.alarm_events WHERE id=_event_id AND user_id=u FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'alarm not found' USING ERRCODE='42501'; END IF;
  IF e.status='solved' THEN RETURN jsonb_build_object('solved',true,'correct',true,'awarded',0,'result','daily_claimed','event',public.wake_event_payload(e.id)); END IF;
  IF e.question_type NOT IN ('shake','typing','tiles') THEN RAISE EXCEPTION 'This alarm uses a question challenge'; END IF;
  IF e.status<>'ringing' OR e.question_version<>_version THEN RAISE EXCEPTION 'Challenge changed. Reload the current question.'; END IF;
  IF e.last_answer_at>now()-interval '400 milliseconds' THEN RAISE EXCEPTION 'Please wait before another answer'; END IF;
  IF e.mission_rejections>=5 AND e.mission_last_reject_at>now()-interval '60 seconds' THEN RAISE EXCEPTION 'Too many attempts. Keep going and try again in a minute.'; END IF;
  IF jsonb_typeof(_proof)<>'object' OR pg_column_size(_proof)>8000 THEN RAISE EXCEPTION 'invalid proof'; END IF;
  lvl:=greatest(1,least(3,coalesce(e.difficulty,2))); rounds:=greatest(1,least(3,coalesce((e.question_text::jsonb->>'rounds')::integer,1)));
  srv:=extract(epoch FROM now()-coalesce(e.mission_issued_at,now())); cli:=coalesce((_proof->>'elapsed_ms')::numeric,0)/1000;
  IF e.question_type='shake' THEN
    target:=(CASE lvl WHEN 1 THEN 20 WHEN 2 THEN 40 ELSE 70 END)*rounds; shakes:=coalesce((_proof->>'shakes')::integer,0);
    ok:= shakes>=target AND cli>=target/7.0*0.9 AND srv>=target/7.0*0.9; reason:='shake';
  ELSIF e.question_type='typing' THEN
    expected:=string_to_array(e.question_answer,E'\n'); typed:=_proof->'typed';
    ok:= jsonb_typeof(typed)='array' AND jsonb_array_length(typed)=array_length(expected,1);
    IF ok THEN FOR i IN 1..array_length(expected,1) LOOP
      ok:= ok AND CASE WHEN lvl=3 THEN typed->>(i-1)=expected[i] ELSE lower(typed->>(i-1))=lower(expected[i]) END;
      chars:=chars+length(expected[i]);
    END LOOP; END IF;
    ok:= ok AND cli>=greatest(2,chars/12.0) AND srv>=greatest(2,chars/12.0); reason:='typing';
  ELSE
    taps:=coalesce((_proof->>'taps')::integer,0); tg:=coalesce((_proof->>'targets')::integer,0);
    ok:= tg BETWEEN (CASE lvl WHEN 1 THEN 3 WHEN 2 THEN 5 ELSE 8 END)*rounds AND (CASE lvl WHEN 1 THEN 4 WHEN 2 THEN 6 ELSE 10 END)*rounds AND taps>=tg AND cli>=tg*1.0 AND srv>=tg*1.0; reason:='tiles';
  END IF;
  IF NOT ok THEN
    UPDATE public.alarm_events SET mission_rejections=CASE WHEN mission_last_reject_at>now()-interval '60 seconds' THEN mission_rejections+1 ELSE 1 END, mission_last_reject_at=now(), last_answer_at=now() WHERE id=e.id;
    INSERT INTO public.wake_delivery_log(event_id,kind,detail) VALUES(e.id,'mission_rejected',reason);
    RETURN jsonb_build_object('solved',false,'correct',false,'rejected',true,'event',public.wake_event_payload(e.id));
  END IF;
  UPDATE public.alarm_events SET last_answer_at=now() WHERE id=e.id;
  RETURN public.wake_finalize_solve(e.id);
END; $$;

CREATE OR REPLACE FUNCTION public.wake_set_mission_options(_rounds smallint, _lang text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=auth.uid();
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE='42501'; END IF;
  IF _rounds NOT BETWEEN 1 AND 3 OR _lang NOT IN ('en','hi') THEN RAISE EXCEPTION 'invalid settings'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(u::text,74011));
  IF EXISTS(SELECT 1 FROM public.alarm_events WHERE user_id=u AND status='ringing') THEN RAISE EXCEPTION 'Solve the ringing alarm before changing settings'; END IF;
  UPDATE public.alarms SET wake_mission_rounds=_rounds, wake_mission_lang=_lang WHERE user_id=u AND label='AXEN Wake Protocol';
END; $$;

REVOKE ALL ON FUNCTION public.wake_issue_mission(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.wake_finalize_solve(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.wake_complete_mission(uuid,integer,jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.wake_set_mission_options(smallint,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.wake_complete_mission(uuid,integer,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.wake_set_mission_options(smallint,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.wake_issue_mission(uuid), public.wake_finalize_solve(uuid) TO service_role;