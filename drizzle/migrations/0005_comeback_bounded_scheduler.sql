-- lovable-cron-fallback-reviewed: SQL-only future completion; one shared job armed on comeback start and unscheduled after drain, at most one minute delay
CREATE OR REPLACE FUNCTION public.arm_comeback_scheduler() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
 IF NEW.is_recovery AND NEW.status='active' AND NEW.comeback_ends_at IS NOT NULL AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
   PERFORM cron.schedule('axen-sweep-comebacks','* * * * *','select public.sweep_due_comebacks();');
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.arm_comeback_scheduler() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER arm_comeback_scheduler AFTER INSERT OR UPDATE OF status ON public.daily_contracts FOR EACH ROW EXECUTE FUNCTION public.arm_comeback_scheduler();
CREATE OR REPLACE FUNCTION public.sweep_due_comebacks() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE _id uuid; _n integer:=0; _job bigint;
BEGIN
 FOR _id IN SELECT id FROM public.daily_contracts WHERE is_recovery AND status='active' AND comeback_ends_at<=now() LIMIT 500 LOOP
  IF public.axen_finalize_comeback(_id) THEN _n:=_n+1; END IF;
 END LOOP;
 IF NOT EXISTS(SELECT 1 FROM public.daily_contracts WHERE is_recovery AND status='active' AND comeback_ends_at IS NOT NULL) THEN
  FOR _job IN SELECT jobid FROM cron.job WHERE jobname='axen-sweep-comebacks' LOOP PERFORM cron.unschedule(_job); END LOOP;
 END IF;
 RETURN _n;
END $$;
REVOKE ALL ON FUNCTION public.sweep_due_comebacks() FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.validate_comeback_window() RETURNS trigger LANGUAGE plpgsql SET search_path TO '' AS $$
BEGIN
 IF NEW.is_recovery AND NEW.status='active' AND OLD.status='scheduled' THEN
  IF NEW.comeback_ends_at>NEW.expires_at THEN RAISE EXCEPTION 'recovery window closed' USING ERRCODE='22023'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER validate_comeback_window BEFORE UPDATE ON public.daily_contracts FOR EACH ROW EXECUTE FUNCTION public.validate_comeback_window();
DO $$ DECLARE _def text; BEGIN
 SELECT pg_get_functiondef('public.end_contract_session(uuid,text)'::regprocedure) INTO _def;
 _def:=replace(_def,'SELECT * INTO _s FROM public.contract_sessions WHERE id = _session_id AND user_id = _uid FOR UPDATE;','SELECT * INTO _s FROM public.contract_sessions WHERE id = _session_id AND user_id = _uid;');
 _def:=replace(_def,'SELECT * INTO _c FROM public.daily_contracts WHERE id = _s.contract_id FOR UPDATE;','SELECT * INTO _c FROM public.daily_contracts WHERE id = _s.contract_id FOR UPDATE; SELECT * INTO _s FROM public.contract_sessions WHERE id = _session_id FOR UPDATE; IF _s.session_status <> ''active'' THEN RETURN _s; END IF;');
 EXECUTE _def;
END $$;