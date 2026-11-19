CREATE OR REPLACE FUNCTION public.my_active_partner()
 RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE WHEN a.user_id = auth.uid() THEN a.partner_id ELSE a.user_id END
  FROM public.accountability_connections a
  WHERE auth.uid() IS NOT NULL AND a.status = 'active'
    AND (a.user_id = auth.uid() OR a.partner_id = auth.uid())
  LIMIT 1;
$$;
CREATE OR REPLACE FUNCTION public.is_active_partner(_other uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL AND _other IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.accountability_connections a
    WHERE a.status = 'active'
      AND ((a.user_id = auth.uid() AND a.partner_id = _other) OR (a.partner_id = auth.uid() AND a.user_id = _other)));
$$;
REVOKE ALL ON FUNCTION public.my_active_partner() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_active_partner(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_active_partner() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_active_partner(uuid) TO authenticated;

REVOKE ALL ON public.acct_cheers, public.acct_checkins, public.acct_settings, public.acct_milestones_seen FROM anon;

CREATE OR REPLACE FUNCTION public.get_partner_today()
 RETURNS TABLE(partner_id uuid, status contract_status, local_day date)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT c.user_id, c.status, c.local_day
  FROM public.accountability_connections a
  JOIN public.daily_contracts c
    ON c.user_id = CASE WHEN a.user_id = auth.uid() THEN a.partner_id ELSE a.user_id END
  WHERE a.status = 'active' AND a.share_status
    AND (a.user_id = auth.uid() OR a.partner_id = auth.uid())
    AND (CASE WHEN a.user_id = auth.uid() THEN a.share_by_partner ELSE a.share_by_user END)
    AND c.accountability_enabled AND c.is_recovery = false
    AND c.local_day = (now() AT TIME ZONE c.timezone)::date;
$function$;

CREATE POLICY "proofs owner read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'proofs' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "proofs owner insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'proofs' AND (storage.foldername(name))[1] = auth.uid()::text
    AND lower(storage.extension(name)) IN ('jpg','jpeg','png','webp','heic','heif'));
CREATE POLICY "proofs owner delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'proofs' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "proofs partner read submitted" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'proofs' AND EXISTS (
    SELECT 1 FROM public.proof_submissions ps
    WHERE ps.private_storage_path = storage.objects.name
      AND (storage.foldername(storage.objects.name))[1] = ps.user_id::text
      AND public.is_active_partner(ps.user_id)));