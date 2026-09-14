
REVOKE EXECUTE ON FUNCTION public.initialize_trial() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_entitlement() FROM anon;

DROP POLICY IF EXISTS "billing_notifications_no_client_access" ON public.billing_notifications;
CREATE POLICY "billing_notifications_no_client_access" ON public.billing_notifications
  FOR SELECT TO authenticated USING (false);
