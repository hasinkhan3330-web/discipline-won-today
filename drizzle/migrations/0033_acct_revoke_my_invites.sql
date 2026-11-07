CREATE OR REPLACE FUNCTION public.acct_revoke_my_invites()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE _n integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501'; END IF;
  PERFORM pg_catalog.set_config('axen.contract_write', 'on', true);
  UPDATE public.accountability_invites SET revoked_at = now()
   WHERE inviter_id = auth.uid() AND accepted_at IS NULL AND revoked_at IS NULL;
  GET DIAGNOSTICS _n = ROW_COUNT;
  RETURN _n;
END $$;
REVOKE ALL ON FUNCTION public.acct_revoke_my_invites() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.acct_revoke_my_invites() TO authenticated;