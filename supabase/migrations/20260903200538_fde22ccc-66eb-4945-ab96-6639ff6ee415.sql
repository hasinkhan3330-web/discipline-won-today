ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS trial_started_at timestamptz;

UPDATE public.profiles
SET trial_started_at = COALESCE(trial_started_at, GREATEST(created_at, trial_ends_at - interval '3 days'))
WHERE trial_started_at IS NULL;

CREATE INDEX IF NOT EXISTS subscriptions_user_status_idx ON public.subscriptions (user_id, status, current_period_end DESC);

-- Block client writes to trial_started_at as well (economy guard).
CREATE OR REPLACE FUNCTION public.guard_profile_economy()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF coalesce(current_setting('app.economy_write', true), 'off') <> 'on' THEN
    NEW.coins := OLD.coins;
    NEW.streak := OLD.streak;
    NEW.longest_streak := OLD.longest_streak;
    NEW.last_activity_date := OLD.last_activity_date;
    NEW.last_penalty_date := OLD.last_penalty_date;
    NEW.shields := OLD.shields;
    NEW.referral_code := OLD.referral_code;
    NEW.referred_by := OLD.referred_by;
    NEW.trial_started_at := OLD.trial_started_at;
    NEW.trial_ends_at := OLD.trial_ends_at;
    NEW.is_subscribed := OLD.is_subscribed;
    NEW.subscription_platform := OLD.subscription_platform;
    NEW.active_subscription_id := OLD.active_subscription_id;
  END IF;
  RETURN NEW;
END;
$function$;

-- Centralized, server-clock entitlement. Idempotently stamps the trial window
-- on first authenticated call; never resets an existing window.
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
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _now timestamptz := now();
  _t_start timestamptz;
  _t_end timestamptz;
  _sub record;
  _sub_active boolean := false;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  PERFORM set_config('app.economy_write', 'on', true);

  SELECT p.trial_started_at, p.trial_ends_at INTO _t_start, _t_end
  FROM public.profiles p WHERE p.id = _uid FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.profiles (id, trial_started_at, trial_ends_at, is_subscribed)
    VALUES (_uid, _now, _now + interval '3 days', false)
    ON CONFLICT (id) DO NOTHING;
    _t_start := _now; _t_end := _now + interval '3 days';
  ELSIF _t_end IS NULL THEN
    UPDATE public.profiles p
      SET trial_started_at = COALESCE(p.trial_started_at, _now),
          trial_ends_at = COALESCE(p.trial_started_at, _now) + interval '3 days'
      WHERE p.id = _uid
      RETURNING p.trial_started_at, p.trial_ends_at INTO _t_start, _t_end;
  ELSIF _t_start IS NULL THEN
    UPDATE public.profiles p SET trial_started_at = _t_end - interval '3 days'
      WHERE p.id = _uid RETURNING p.trial_started_at INTO _t_start;
  END IF;

  SELECT s.status, s.provider, s.price_id, s.current_period_end
    INTO _sub
    FROM public.subscriptions s
    WHERE s.user_id = _uid
    ORDER BY
      (CASE WHEN (s.status IN ('active','trialing','past_due')
                  AND (s.current_period_end IS NULL OR s.current_period_end > _now))
              OR (s.status = 'canceled' AND s.current_period_end > _now)
            THEN 0 ELSE 1 END),
      s.current_period_end DESC NULLS LAST,
      s.created_at DESC
    LIMIT 1;

  IF _sub.status IS NOT NULL THEN
    _sub_active := (_sub.status IN ('active','trialing','past_due')
                    AND (_sub.current_period_end IS NULL OR _sub.current_period_end > _now))
                   OR (_sub.status = 'canceled' AND _sub.current_period_end > _now);
  END IF;

  is_premium := _sub_active OR (_t_end IS NOT NULL AND _t_end > _now);
  trial_day := CASE
    WHEN _t_end IS NULL THEN NULL
    WHEN _t_end <= _now THEN 0
    ELSE LEAST(3, GREATEST(1, (EXTRACT(EPOCH FROM (_now - _t_start)) / 86400)::int + 1))
  END;
  trial_started_at := _t_start;
  trial_ends_at := _t_end;
  subscription_status := _sub.status;
  subscription_provider := _sub.provider;
  plan := _sub.price_id;
  current_period_end := _sub.current_period_end;
  server_now := _now;
  RETURN NEXT;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_entitlement() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_entitlement() TO authenticated, service_role;