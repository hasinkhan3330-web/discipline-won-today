
CREATE TABLE IF NOT EXISTS public.entitlements (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  trial_claimed boolean NOT NULL DEFAULT false,
  subscription_status text NOT NULL DEFAULT 'none',
  subscription_expires_at timestamptz,
  product_id text,
  purchase_token_hash text UNIQUE,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.entitlements TO authenticated;
GRANT ALL ON public.entitlements TO service_role;

ALTER TABLE public.entitlements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "entitlements_select_own" ON public.entitlements;
CREATE POLICY "entitlements_select_own" ON public.entitlements
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS entitlements_trial_ends_at_idx ON public.entitlements(trial_ends_at);
CREATE INDEX IF NOT EXISTS entitlements_sub_expires_idx ON public.entitlements(subscription_expires_at);

CREATE TABLE IF NOT EXISTS public.billing_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text NOT NULL UNIQUE,
  provider text NOT NULL DEFAULT 'google_play',
  event_type text,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  processed_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.billing_notifications TO service_role;
ALTER TABLE public.billing_notifications ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS billing_notifications_user_idx ON public.billing_notifications(user_id);

CREATE OR REPLACE FUNCTION public.initialize_trial()
RETURNS TABLE(trial_started_at timestamptz, trial_ends_at timestamptz, trial_claimed boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE _uid uuid := auth.uid(); _row public.entitlements%ROWTYPE;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  INSERT INTO public.entitlements(user_id, trial_started_at, trial_ends_at, trial_claimed, updated_at)
  VALUES (_uid, now(), now() + interval '72 hours', true, now())
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO _row FROM public.entitlements e WHERE e.user_id = _uid FOR UPDATE;

  IF NOT _row.trial_claimed THEN
    UPDATE public.entitlements e
      SET trial_started_at = COALESCE(e.trial_started_at, now()),
          trial_ends_at = COALESCE(e.trial_ends_at, now() + interval '72 hours'),
          trial_claimed = true,
          updated_at = now()
      WHERE e.user_id = _uid
      RETURNING * INTO _row;
  END IF;

  trial_started_at := _row.trial_started_at;
  trial_ends_at := _row.trial_ends_at;
  trial_claimed := _row.trial_claimed;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.initialize_trial() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.initialize_trial() TO authenticated;

CREATE OR REPLACE FUNCTION public.has_premium_access(_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions s
    WHERE s.user_id = _user_id
      AND (
        (s.status IN ('active','past_due') AND (s.current_period_end IS NULL OR s.current_period_end > now()))
        OR (s.status = 'canceled' AND s.current_period_end > now())
      )
  ) OR EXISTS (
    SELECT 1 FROM public.entitlements e
    WHERE e.user_id = _user_id
      AND e.trial_claimed
      AND e.trial_ends_at IS NOT NULL
      AND e.trial_ends_at > now()
  )
$$;

DROP FUNCTION IF EXISTS public.get_entitlement();
CREATE FUNCTION public.get_entitlement()
RETURNS TABLE(
  is_premium boolean,
  premium_access boolean,
  access_status text,
  trial_day integer,
  remaining_seconds integer,
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
SET search_path = ''
AS $$
DECLARE
  _uid uuid := auth.uid();
  _sub public.subscriptions%ROWTYPE;
  _ent public.entitlements%ROWTYPE;
  _now timestamptz := now();
  _subscribed boolean;
  _trialing boolean;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  SELECT s.* INTO _sub FROM public.subscriptions s
  WHERE s.user_id = _uid
    AND (
      (s.status IN ('active','trialing','past_due') AND (s.current_period_end IS NULL OR s.current_period_end > _now))
      OR (s.status = 'canceled' AND s.current_period_end > _now)
    )
  ORDER BY s.created_at DESC LIMIT 1;

  SELECT e.* INTO _ent FROM public.entitlements e WHERE e.user_id = _uid;

  _subscribed := _sub.id IS NOT NULL;
  _trialing := COALESCE(_ent.trial_claimed, false)
               AND _ent.trial_ends_at IS NOT NULL
               AND _ent.trial_ends_at > _now;

  is_premium := _subscribed;
  premium_access := _subscribed OR _trialing;
  access_status := CASE
    WHEN _subscribed THEN 'subscribed'
    WHEN _trialing THEN 'trial'
    WHEN COALESCE(_ent.trial_claimed, false) THEN 'expired'
    ELSE 'basic' END;
  remaining_seconds := CASE WHEN _trialing
    THEN GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (_ent.trial_ends_at - _now)))::int) ELSE 0 END;
  trial_day := CASE WHEN _trialing
    THEN LEAST(3, GREATEST(1, FLOOR(EXTRACT(EPOCH FROM (_now - _ent.trial_started_at)) / 86400)::int + 1))
    ELSE 0 END;
  trial_started_at := _ent.trial_started_at;
  trial_ends_at := _ent.trial_ends_at;
  subscription_status := _sub.status;
  subscription_provider := _sub.provider;
  plan := _sub.price_id;
  current_period_end := _sub.current_period_end;
  server_now := _now;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.get_entitlement() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_entitlement() TO authenticated;
