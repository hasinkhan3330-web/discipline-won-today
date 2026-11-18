REVOKE ALL ON public.partner_events FROM anon, authenticated;
GRANT SELECT ON public.partner_events TO authenticated;
GRANT UPDATE (seen_at) ON public.partner_events TO authenticated;