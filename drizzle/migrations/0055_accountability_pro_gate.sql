DO $mig$
DECLARE f text; d text; i int; g text := 'coalesce((SELECT ge.premium_access FROM public.get_entitlement() ge),false)';
BEGIN
  FOREACH f IN ARRAY ARRAY['create_accountability_invite','accept_accountability_invite','acct_revoke_my_invites','get_trust_summary','partner_proof_action','send_nudge','send_accountability_nudge','get_nudge_suggestions','acct_send_cheer','acct_garden_score','acct_pair_streak','acct_partner_checkin_status','acct_partner_garden_stage','acct_weekly_report'] LOOP
    SELECT pg_get_functiondef(p.oid) INTO d FROM pg_proc p WHERE p.proname=f AND p.pronamespace='public'::regnamespace;
    IF d IS NULL OR position('AXEN Pro required' IN d)>0 THEN RAISE EXCEPTION 'unexpected state for %', f; END IF;
    i := position('AS $function$' IN d);
    d := substr(d,1,i-1) || regexp_replace(substr(d,i), '\mBEGIN\M', 'BEGIN IF NOT '||g||' THEN RAISE EXCEPTION ''AXEN Pro required'' USING ERRCODE=''42501''; END IF;', 'i');
    EXECUTE d;
  END LOOP;
  FOREACH f IN ARRAY ARRAY['get_my_accountability','get_partner_reviews','get_partner_today','get_partner_contract_summary'] LOOP
    SELECT pg_get_functiondef(p.oid) INTO d FROM pg_proc p WHERE p.proname=f AND p.pronamespace='public'::regnamespace;
    IF d IS NULL OR position('ge.premium_access' IN d)>0 THEN RAISE EXCEPTION 'unexpected state for %', f; END IF;
    i := position('AS $function$' IN d);
    d := substr(d,1,i-1) || regexp_replace(substr(d,i), '\mWHERE ', 'WHERE '||g||' AND ');
    EXECUTE d;
  END LOOP;
END $mig$;
CREATE POLICY "axen_pro_required" ON public.acct_checkins AS RESTRICTIVE FOR ALL TO authenticated USING (coalesce((SELECT ge.premium_access FROM public.get_entitlement() ge),false)) WITH CHECK (coalesce((SELECT ge.premium_access FROM public.get_entitlement() ge),false));
CREATE POLICY "axen_pro_required" ON public.acct_settings AS RESTRICTIVE FOR ALL TO authenticated USING (coalesce((SELECT ge.premium_access FROM public.get_entitlement() ge),false)) WITH CHECK (coalesce((SELECT ge.premium_access FROM public.get_entitlement() ge),false));
CREATE POLICY "axen_pro_required" ON public.acct_milestones_seen AS RESTRICTIVE FOR ALL TO authenticated USING (coalesce((SELECT ge.premium_access FROM public.get_entitlement() ge),false)) WITH CHECK (coalesce((SELECT ge.premium_access FROM public.get_entitlement() ge),false));
CREATE POLICY "axen_pro_required" ON public.accountability_invites AS RESTRICTIVE FOR ALL TO authenticated USING (coalesce((SELECT ge.premium_access FROM public.get_entitlement() ge),false)) WITH CHECK (coalesce((SELECT ge.premium_access FROM public.get_entitlement() ge),false));
CREATE POLICY "axen_pro_required" ON public.accountability_connections AS RESTRICTIVE FOR ALL TO authenticated USING (coalesce((SELECT ge.premium_access FROM public.get_entitlement() ge),false)) WITH CHECK (coalesce((SELECT ge.premium_access FROM public.get_entitlement() ge),false));
CREATE POLICY "axen_pro_required" ON public.accountability_events AS RESTRICTIVE FOR ALL TO authenticated USING (coalesce((SELECT ge.premium_access FROM public.get_entitlement() ge),false)) WITH CHECK (coalesce((SELECT ge.premium_access FROM public.get_entitlement() ge),false));
CREATE POLICY "axen_pro_required" ON public.acct_cheers AS RESTRICTIVE FOR ALL TO authenticated USING (coalesce((SELECT ge.premium_access FROM public.get_entitlement() ge),false)) WITH CHECK (coalesce((SELECT ge.premium_access FROM public.get_entitlement() ge),false));
CREATE POLICY "axen_pro_required" ON public.partner_events AS RESTRICTIVE FOR ALL TO authenticated USING (coalesce((SELECT ge.premium_access FROM public.get_entitlement() ge),false)) WITH CHECK (coalesce((SELECT ge.premium_access FROM public.get_entitlement() ge),false));
CREATE POLICY "axen_pro_required" ON public.partner_messages AS RESTRICTIVE FOR ALL TO authenticated USING (coalesce((SELECT ge.premium_access FROM public.get_entitlement() ge),false)) WITH CHECK (coalesce((SELECT ge.premium_access FROM public.get_entitlement() ge),false));
CREATE POLICY "axen_pro_required" ON public.pact_nudges AS RESTRICTIVE FOR ALL TO authenticated USING (coalesce((SELECT ge.premium_access FROM public.get_entitlement() ge),false)) WITH CHECK (coalesce((SELECT ge.premium_access FROM public.get_entitlement() ge),false));
CREATE POLICY "axen_pro_required" ON public.trust_events AS RESTRICTIVE FOR ALL TO authenticated USING (coalesce((SELECT ge.premium_access FROM public.get_entitlement() ge),false)) WITH CHECK (coalesce((SELECT ge.premium_access FROM public.get_entitlement() ge),false));