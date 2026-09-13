UPDATE public.profiles
SET trial_started_at = NULL,
    trial_ends_at = NULL
WHERE trial_started_at IS NOT NULL OR trial_ends_at IS NOT NULL;

REVOKE EXECUTE ON FUNCTION public.ensure_app_trial() FROM authenticated;

CREATE OR REPLACE FUNCTION public.has_premium_access(_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.subscriptions s
    WHERE s.user_id = _user_id
      AND (
        (s.status IN ('active', 'past_due') AND (s.current_period_end IS NULL OR s.current_period_end > now()))
        OR (s.status = 'canceled' AND s.current_period_end > now())
      )
  )
$$;

REVOKE ALL ON FUNCTION public.has_premium_access(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_premium_access(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_entitlement()
RETURNS TABLE(
  is_premium boolean,
  trial_day integer,
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  subscription_status text,
  subscription_provider text,
  plan text,
  current_period_end timestamptz,
  server_now timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _sub public.subscriptions%ROWTYPE;
  _now timestamptz := now();
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT s.* INTO _sub
  FROM public.subscriptions s
  WHERE s.user_id = _uid
    AND (
      (s.status IN ('active', 'past_due') AND (s.current_period_end IS NULL OR s.current_period_end > _now))
      OR (s.status = 'canceled' AND s.current_period_end > _now)
    )
  ORDER BY s.created_at DESC
  LIMIT 1;

  is_premium := _sub.id IS NOT NULL;
  trial_day := 0;
  trial_started_at := NULL;
  trial_ends_at := NULL;
  subscription_status := _sub.status;
  subscription_provider := _sub.provider;
  plan := _sub.price_id;
  current_period_end := _sub.current_period_end;
  server_now := _now;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.get_entitlement() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_entitlement() TO authenticated, service_role;