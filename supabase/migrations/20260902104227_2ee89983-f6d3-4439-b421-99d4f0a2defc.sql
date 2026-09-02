-- 1. Extend profiles with trial + subscription state
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_subscribed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS subscription_platform text,
  ADD COLUMN IF NOT EXISTS active_subscription_id text;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_subscription_platform_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_subscription_platform_check
  CHECK (subscription_platform IS NULL OR subscription_platform IN ('google_play','apple_iap','razorpay','paypal','upi'));

-- Backfill trial window from existing app_trials
UPDATE public.profiles p
SET trial_ends_at = t.trial_ends_at
FROM public.app_trials t
WHERE t.user_id = p.id AND p.trial_ends_at IS NULL;

-- Fallback for any profile without a trial record
UPDATE public.profiles
SET trial_ends_at = created_at + interval '3 days'
WHERE trial_ends_at IS NULL;

-- Mark existing paid users as subscribed
UPDATE public.profiles p
SET is_subscribed = true,
    subscription_platform = COALESCE(p.subscription_platform, s.provider),
    active_subscription_id = COALESCE(p.active_subscription_id, s.provider_subscription_id)
FROM public.subscriptions s
WHERE s.user_id = p.id
  AND (s.status IN ('active','trialing') AND (s.current_period_end IS NULL OR s.current_period_end > now())
       OR (s.status = 'canceled' AND s.current_period_end > now()));

-- 2. Extend economy guard: trial/subscription state is server-managed only
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
    NEW.trial_ends_at := OLD.trial_ends_at;
    NEW.is_subscribed := OLD.is_subscribed;
    NEW.subscription_platform := OLD.subscription_platform;
    NEW.active_subscription_id := OLD.active_subscription_id;
  END IF;
  RETURN NEW;
END;
$function$;

-- 3. Update signup trigger: initialize 3-day trial on every new user (server clock)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM set_config('app.economy_write', 'on', true);

  INSERT INTO public.profiles (id, display_name, trial_ends_at, is_subscribed)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    now() + interval '3 days',
    false
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.tasks (user_id, icon, name, pts, sort_order) VALUES
    (NEW.id, '🌅', 'Wake Up 4AM',  21, 1),
    (NEW.id, '🚿', 'Cold Shower',  10, 2),
    (NEW.id, '💪', 'Workout',      15, 3),
    (NEW.id, '📚', 'Deep Focus',    8, 4),
    (NEW.id, '🍔', 'No Junk Food', 15, 5);

  RETURN NEW;
END;
$function$;

-- 4. Server-side premium access check (never trusts client time)
CREATE OR REPLACE FUNCTION public.has_premium_access(_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = _user_id
      AND (p.is_subscribed = true OR p.trial_ends_at IS NULL OR p.trial_ends_at > now())
  );
$function$;

REVOKE ALL ON FUNCTION public.has_premium_access(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_premium_access(uuid) TO authenticated;

-- 5. RESTRICTIVE gating policies: premium data requires active trial or subscription
-- Zen Mode / Deep Focus sessions
DROP POLICY IF EXISTS focus_sessions_premium_gate ON public.focus_sessions;
CREATE POLICY focus_sessions_premium_gate ON public.focus_sessions
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.has_premium_access(auth.uid()))
  WITH CHECK (public.has_premium_access(auth.uid()));

-- Habit reminders (premium feature)
DROP POLICY IF EXISTS habit_reminders_premium_gate ON public.habit_reminders;
CREATE POLICY habit_reminders_premium_gate ON public.habit_reminders
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.has_premium_access(auth.uid()))
  WITH CHECK (public.has_premium_access(auth.uid()));

-- Friends / accountability
DROP POLICY IF EXISTS friendships_premium_gate ON public.friendships;
CREATE POLICY friendships_premium_gate ON public.friendships
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.has_premium_access(auth.uid()))
  WITH CHECK (public.has_premium_access(auth.uid()));

-- Streak shields (premium store item)
DROP POLICY IF EXISTS shield_uses_premium_gate ON public.streak_shield_uses;
CREATE POLICY shield_uses_premium_gate ON public.streak_shield_uses
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.has_premium_access(auth.uid()))
  WITH CHECK (public.has_premium_access(auth.uid()));

-- 6. Keep profiles.is_subscribed in sync with the subscriptions table
CREATE OR REPLACE FUNCTION public.sync_profile_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM set_config('app.economy_write', 'on', true);
  UPDATE public.profiles p
  SET is_subscribed = public.has_active_subscription(NEW.user_id, 'live')
                       OR public.has_active_subscription(NEW.user_id, 'sandbox'),
      subscription_platform = CASE
        WHEN (NEW.status IN ('active','trialing') AND (NEW.current_period_end IS NULL OR NEW.current_period_end > now()))
          OR (NEW.status = 'canceled' AND NEW.current_period_end > now())
        THEN NEW.provider ELSE p.subscription_platform END,
      active_subscription_id = CASE
        WHEN (NEW.status IN ('active','trialing') AND (NEW.current_period_end IS NULL OR NEW.current_period_end > now()))
          OR (NEW.status = 'canceled' AND NEW.current_period_end > now())
        THEN NEW.provider_subscription_id ELSE p.active_subscription_id END
  WHERE p.id = NEW.user_id;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS sync_profile_subscription_trg ON public.subscriptions;
CREATE TRIGGER sync_profile_subscription_trg
AFTER INSERT OR UPDATE OF status, current_period_end ON public.subscriptions
FOR EACH ROW EXECUTE FUNCTION public.sync_profile_subscription();