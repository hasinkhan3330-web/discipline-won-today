-- AXEN STAGING BASELINE — FORWARD (generated, NOT executed/tested against any database)
-- Run ONCE in the STAGING SQL Editor only. NEVER on project ref nfmgiczlthezfwgsazfc (LIVE).
-- Source: exact replay of the 63 applied migrations in supabase/migrations, in timestamp order.
-- Run WITHOUT wrapping in a transaction (some steps use ALTER TYPE ... ADD VALUE).

-- Safety guard: abort if this database already has users or AXEN tables (i.e. not an empty staging project).
DO $guard$ BEGIN
  IF EXISTS (SELECT 1 FROM auth.users LIMIT 1) THEN RAISE EXCEPTION 'ABORT: auth.users is not empty - this does not look like empty staging'; END IF;
  IF to_regclass('public.profiles') IS NOT NULL THEN RAISE EXCEPTION 'ABORT: public.profiles already exists'; END IF;
END $guard$;


-- ==== 20260724183327_ed160bfe-6d85-4461-b552-e0e8e5b90040.sql ====
CREATE TABLE public.profiles (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  coins INTEGER NOT NULL DEFAULT 0,
  streak INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==== 20260724183342_058dbaf6-d992-4b99-8b36-a5b40b634bb0.sql ====
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- ==== 20260724183940_04040f8a-947c-4c60-a83a-93e435f94f81.sql ====
-- 1. Extend profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username text UNIQUE,
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS longest_streak integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_activity_date date;

-- Public leaderboard view (safe columns only)
CREATE OR REPLACE VIEW public.public_profiles
WITH (security_invoker=on) AS
SELECT id, display_name, username, avatar_url, coins, streak, longest_streak
FROM public.profiles;

GRANT SELECT ON public.public_profiles TO authenticated;

-- Allow all authenticated users to read leaderboard fields; keep row-level restriction on direct profile access
DROP POLICY IF EXISTS "Public can view leaderboard profiles" ON public.profiles;
CREATE POLICY "Public can view leaderboard profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (true);

-- The existing "Users can view own profile" policy remains; the new permissive SELECT covers leaderboard.
-- To keep private info hidden we rely on the view for cross-user reads and never SELECT profiles.* directly for other users from the client.

-- 2. Updated-at trigger reuse
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- 3. TASKS
CREATE TABLE IF NOT EXISTS public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  icon text NOT NULL DEFAULT '🎯',
  name text NOT NULL,
  pts integer NOT NULL DEFAULT 10 CHECK (pts >= 0),
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own tasks all" ON public.tasks FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_tasks_user ON public.tasks(user_id, sort_order);
CREATE TRIGGER tasks_updated_at BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. TASK COMPLETIONS
CREATE TABLE IF NOT EXISTS public.task_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  completed_on date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  coins_awarded integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, task_id, completed_on)
);
GRANT SELECT, INSERT, DELETE ON public.task_completions TO authenticated;
GRANT ALL ON public.task_completions TO service_role;
ALTER TABLE public.task_completions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own completions" ON public.task_completions FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_tc_user_date ON public.task_completions(user_id, completed_on);

-- 5. COIN TRANSACTIONS
CREATE TABLE IF NOT EXISTS public.coin_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount integer NOT NULL,
  reason text NOT NULL,
  ref_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.coin_transactions TO authenticated;
GRANT ALL ON public.coin_transactions TO service_role;
ALTER TABLE public.coin_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own coin tx" ON public.coin_transactions FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_ct_user ON public.coin_transactions(user_id, created_at DESC);

-- 6. ALARMS
CREATE TABLE IF NOT EXISTS public.alarms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  time time NOT NULL,
  label text,
  tone text NOT NULL DEFAULT 'default',
  days integer[] NOT NULL DEFAULT '{0,1,2,3,4,5,6}',
  challenge_type text NOT NULL DEFAULT 'math' CHECK (challenge_type IN ('math','physics','none')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.alarms TO authenticated;
GRANT ALL ON public.alarms TO service_role;
ALTER TABLE public.alarms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own alarms" ON public.alarms FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_alarms_user ON public.alarms(user_id);
CREATE TRIGGER alarms_updated_at BEFORE UPDATE ON public.alarms
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 7. ALARM SESSIONS
CREATE TABLE IF NOT EXISTS public.alarm_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  alarm_id uuid NOT NULL REFERENCES public.alarms(id) ON DELETE CASCADE,
  completed_on date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  coins_awarded integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, alarm_id, completed_on)
);
GRANT SELECT, INSERT ON public.alarm_sessions TO authenticated;
GRANT ALL ON public.alarm_sessions TO service_role;
ALTER TABLE public.alarm_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own alarm sessions" ON public.alarm_sessions FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 8. Core RPC: complete_task (idempotent per day, safely updates coins+streak)
CREATE OR REPLACE FUNCTION public.complete_task(_task_id uuid)
RETURNS TABLE(coins integer, streak integer, longest_streak integer, awarded integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _pts integer;
  _today date := (now() AT TIME ZONE 'utc')::date;
  _last date;
  _new_streak integer;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT pts INTO _pts FROM public.tasks WHERE id = _task_id AND user_id = _uid AND is_active;
  IF _pts IS NULL THEN RAISE EXCEPTION 'task not found'; END IF;

  -- idempotent insert
  INSERT INTO public.task_completions(user_id, task_id, completed_on, coins_awarded)
  VALUES (_uid, _task_id, _today, _pts)
  ON CONFLICT (user_id, task_id, completed_on) DO NOTHING;

  IF NOT FOUND THEN
    -- already completed today; return current state
    SELECT p.coins, p.streak, p.longest_streak INTO coins, streak, longest_streak FROM public.profiles p WHERE p.id = _uid;
    awarded := 0;
    RETURN NEXT;
    RETURN;
  END IF;

  -- streak update
  SELECT last_activity_date INTO _last FROM public.profiles WHERE id = _uid;
  IF _last = _today THEN
    SELECT streak INTO _new_streak FROM public.profiles WHERE id = _uid;
  ELSIF _last = _today - 1 THEN
    SELECT streak + 1 INTO _new_streak FROM public.profiles WHERE id = _uid;
  ELSE
    _new_streak := 1;
  END IF;

  UPDATE public.profiles
    SET coins = coins + _pts,
        streak = _new_streak,
        longest_streak = GREATEST(longest_streak, _new_streak),
        last_activity_date = _today
    WHERE id = _uid;

  INSERT INTO public.coin_transactions(user_id, amount, reason, ref_id)
  VALUES (_uid, _pts, 'task', _task_id);

  SELECT p.coins, p.streak, p.longest_streak INTO coins, streak, longest_streak FROM public.profiles p WHERE p.id = _uid;
  awarded := _pts;
  RETURN NEXT;
END; $$;
REVOKE ALL ON FUNCTION public.complete_task(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_task(uuid) TO authenticated;

-- 9. RPC: complete_alarm
CREATE OR REPLACE FUNCTION public.complete_alarm(_alarm_id uuid, _reward integer DEFAULT 10)
RETURNS TABLE(coins integer, awarded integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _today date := (now() AT TIME ZONE 'utc')::date;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  PERFORM 1 FROM public.alarms WHERE id = _alarm_id AND user_id = _uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'alarm not found'; END IF;

  INSERT INTO public.alarm_sessions(user_id, alarm_id, completed_on, coins_awarded)
  VALUES (_uid, _alarm_id, _today, _reward)
  ON CONFLICT (user_id, alarm_id, completed_on) DO NOTHING;

  IF NOT FOUND THEN
    SELECT p.coins INTO coins FROM public.profiles p WHERE p.id = _uid;
    awarded := 0;
    RETURN NEXT;
    RETURN;
  END IF;

  UPDATE public.profiles SET coins = coins + _reward WHERE id = _uid;
  INSERT INTO public.coin_transactions(user_id, amount, reason, ref_id)
  VALUES (_uid, _reward, 'alarm', _alarm_id);

  SELECT p.coins INTO coins FROM public.profiles p WHERE p.id = _uid;
  awarded := _reward;
  RETURN NEXT;
END; $$;
REVOKE ALL ON FUNCTION public.complete_alarm(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_alarm(uuid, integer) TO authenticated;

-- 10. Seed default tasks on signup — extend existing handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.tasks (user_id, icon, name, pts, sort_order) VALUES
    (NEW.id, '🌅', 'Wake Up 4AM',   10, 1),
    (NEW.id, '🚿', 'Cold Shower',    4, 2),
    (NEW.id, '💪', 'Workout',       15, 3),
    (NEW.id, '📚', 'Deep Focus',     8, 4),
    (NEW.id, '📵', 'Phone Free',     5, 5),
    (NEW.id, '🎯', 'Daily Goals',    4, 6),
    (NEW.id, '🍔', 'No Junk Food',   4, 7),
    (NEW.id, '🧘', 'Meditation',     3, 8);

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 11. Backfill: seed default tasks for existing users who have none
INSERT INTO public.tasks (user_id, icon, name, pts, sort_order)
SELECT u.id, t.icon, t.name, t.pts, t.sort_order
FROM auth.users u
CROSS JOIN (VALUES
  ('🌅','Wake Up 4AM',10,1),
  ('🚿','Cold Shower',4,2),
  ('💪','Workout',15,3),
  ('📚','Deep Focus',8,4),
  ('📵','Phone Free',5,5),
  ('🎯','Daily Goals',4,6),
  ('🍔','No Junk Food',4,7),
  ('🧘','Meditation',3,8)
) AS t(icon,name,pts,sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.tasks WHERE user_id = u.id);

-- 12. Storage: avatars bucket policies (bucket itself is created by tool call)

-- ==== 20260724184006_9af87232-9a99-40da-aa43-93da6943be69.sql ====
CREATE POLICY "avatars read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'avatars');
CREATE POLICY "avatars insert own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "avatars update own" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "avatars delete own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ==== 20260725064244_a34171d4-174f-417a-b90e-5cb217d65028.sql ====
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_penalty_date date;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.tasks (user_id, icon, name, pts, sort_order) VALUES
    (NEW.id, '🌅', 'Wake Up 4AM',   10, 1),
    (NEW.id, '🚿', 'Cold Shower',    4, 2),
    (NEW.id, '💪', 'Workout',       15, 3),
    (NEW.id, '📚', 'Deep Focus',     8, 4),
    (NEW.id, '📵', 'Phone Free',     5, 5),
    (NEW.id, '🎯', 'Daily Goals',    4, 6),
    (NEW.id, '🍔', 'No Junk Food',  15, 7),
    (NEW.id, '🧘', 'Meditation',    10, 8);

  RETURN NEW;
END; $function$;

-- ==== 20260725064310_000b2fd0-49cd-448f-91da-9879bbf8c6c4.sql ====
CREATE OR REPLACE FUNCTION public.apply_daily_penalty()
RETURNS TABLE(coins integer, penalized boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _yesterday date := ((now() AT TIME ZONE 'utc')::date) - 1;
  _last_pen date;
  _total int;
  _done int;
  _new_coins int;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT last_penalty_date, p.coins INTO _last_pen, _new_coins FROM public.profiles p WHERE p.id = _uid;
  IF _last_pen IS NOT NULL AND _last_pen >= _yesterday THEN
    coins := _new_coins; penalized := false; RETURN NEXT; RETURN;
  END IF;

  SELECT count(*) INTO _total FROM public.tasks WHERE user_id = _uid AND is_active;
  IF _total = 0 THEN
    UPDATE public.profiles SET last_penalty_date = _yesterday WHERE id = _uid;
    coins := _new_coins; penalized := false; RETURN NEXT; RETURN;
  END IF;

  SELECT count(*) INTO _done FROM public.task_completions WHERE user_id = _uid AND completed_on = _yesterday;

  IF _done < _total THEN
    _new_coins := GREATEST(0, _new_coins - 3);
    UPDATE public.profiles SET coins = _new_coins, last_penalty_date = _yesterday WHERE id = _uid;
    INSERT INTO public.coin_transactions(user_id, amount, reason) VALUES (_uid, -3, 'penalty');
    coins := _new_coins; penalized := true; RETURN NEXT; RETURN;
  END IF;

  UPDATE public.profiles SET last_penalty_date = _yesterday WHERE id = _uid;
  coins := _new_coins; penalized := false; RETURN NEXT;
END; $$;

-- ==== 20260725073609_5054951d-ff94-4d11-bfb0-aa9ab13bc721.sql ====
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  paddle_subscription_id text not null unique,
  paddle_customer_id text not null,
  product_id text not null,
  price_id text not null,
  status text not null default 'active',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean default false,
  environment text not null default 'sandbox',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_subscriptions_user_id on public.subscriptions(user_id);
create index idx_subscriptions_paddle_id on public.subscriptions(paddle_subscription_id);

grant select on public.subscriptions to authenticated;
grant all on public.subscriptions to service_role;

alter table public.subscriptions enable row level security;

create policy "Users can view own subscription"
  on public.subscriptions for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Service role manages subscriptions"
  on public.subscriptions for all
  to service_role
  using (true) with check (true);

create or replace function public.has_active_subscription(
  user_uuid uuid,
  check_env text default 'live'
)
returns boolean language sql security definer set search_path = public as $$
  select exists (
    select 1 from public.subscriptions
    where user_id = user_uuid
    and environment = check_env
    and (
      (status in ('active', 'trialing') and (current_period_end is null or current_period_end > now()))
      or (status = 'canceled' and current_period_end > now())
    )
  );
$$;

grant execute on function public.has_active_subscription(uuid, text) to authenticated;

-- ==== 20260725075653_3b01268f-23b7-4b00-b1b4-80f0dd288a71.sql ====
alter table public.subscriptions replica identity full;
alter publication supabase_realtime add table public.subscriptions;

-- ==== 20260725080803_8d4bd97b-f130-46fd-ae2f-37e2f6157445.sql ====
CREATE TABLE public.payment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  paddle_event_id text NOT NULL UNIQUE,
  event_type text NOT NULL,
  subscription_id text,
  transaction_id text,
  amount integer,
  currency text,
  status text,
  environment text NOT NULL,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_payment_events_user_id ON public.payment_events(user_id);
CREATE INDEX idx_payment_events_subscription_id ON public.payment_events(subscription_id);

GRANT SELECT ON public.payment_events TO authenticated;
GRANT ALL ON public.payment_events TO service_role;

ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own payment events"
  ON public.payment_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role manages payment events"
  ON public.payment_events FOR ALL
  USING (auth.role() = 'service_role');

-- ==== 20260726045219_341301ea-5772-44ab-be7a-a80bfb2b5005.sql ====
-- 1. Remove permissive leaderboard policy on profiles
DROP POLICY IF EXISTS "Public can view leaderboard profiles" ON public.profiles;

-- 2. Ensure public_profiles view is readable for leaderboard
GRANT SELECT ON public.public_profiles TO authenticated, anon;

-- 3. Lock down SECURITY DEFINER functions
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_active_subscription(uuid, text) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.complete_task(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.complete_alarm(uuid, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.apply_daily_penalty() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.complete_task(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_alarm(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_daily_penalty() TO authenticated;

-- ==== 20260726051804_d0b3e0a7-9aa2-4579-8547-6e7b64efe887.sql ====
CREATE TABLE public.app_trials (
  user_id uuid PRIMARY KEY,
  trial_started_at timestamptz NOT NULL DEFAULT now(),
  trial_ends_at timestamptz NOT NULL DEFAULT (now() + interval '3 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_trials_max_three_days CHECK (trial_ends_at <= trial_started_at + interval '3 days')
);

GRANT SELECT ON public.app_trials TO authenticated;
GRANT ALL ON public.app_trials TO service_role;

ALTER TABLE public.app_trials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own app trial"
  ON public.app_trials
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER set_app_trials_updated_at
  BEFORE UPDATE ON public.app_trials
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.ensure_app_trial()
RETURNS TABLE(trial_started_at timestamptz, trial_ends_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  INSERT INTO public.app_trials (user_id)
  VALUES (_uid)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN QUERY
  SELECT t.trial_started_at, t.trial_ends_at
  FROM public.app_trials t
  WHERE t.user_id = _uid;
END;
$function$;

REVOKE ALL ON FUNCTION public.ensure_app_trial() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_app_trial() TO authenticated;

-- ==== 20260726051827_a09d1f16-cf76-439e-929d-5be58c7e1bf5.sql ====
CREATE OR REPLACE FUNCTION public.force_app_trial_window()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  _now timestamptz := now();
BEGIN
  NEW.trial_started_at := _now;
  NEW.trial_ends_at := _now + interval '3 days';
  NEW.created_at := COALESCE(NEW.created_at, _now);
  NEW.updated_at := _now;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER force_app_trial_window_before_insert
  BEFORE INSERT ON public.app_trials
  FOR EACH ROW
  EXECUTE FUNCTION public.force_app_trial_window();

GRANT INSERT ON public.app_trials TO authenticated;

CREATE POLICY "Users can start own app trial"
  ON public.app_trials
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.ensure_app_trial()
RETURNS TABLE(trial_started_at timestamptz, trial_ends_at timestamptz)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  INSERT INTO public.app_trials (user_id)
  VALUES (_uid)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN QUERY
  SELECT t.trial_started_at, t.trial_ends_at
  FROM public.app_trials t
  WHERE t.user_id = _uid;
END;
$function$;

REVOKE ALL ON FUNCTION public.ensure_app_trial() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_app_trial() TO authenticated;

-- ==== 20260727020312_4247ca5f-f9b0-40ef-894f-9ca021cbf017.sql ====
CREATE OR REPLACE FUNCTION public.complete_alarm(_alarm_id uuid, _reward integer DEFAULT 10)
 RETURNS TABLE(coins integer, awarded integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _today date := (now() AT TIME ZONE 'utc')::date;
  _fixed_reward constant integer := 10;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  PERFORM 1 FROM public.alarms WHERE id = _alarm_id AND user_id = _uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'alarm not found'; END IF;

  INSERT INTO public.alarm_sessions(user_id, alarm_id, completed_on, coins_awarded)
  VALUES (_uid, _alarm_id, _today, _fixed_reward)
  ON CONFLICT (user_id, alarm_id, completed_on) DO NOTHING;

  IF NOT FOUND THEN
    SELECT p.coins INTO coins FROM public.profiles p WHERE p.id = _uid;
    awarded := 0;
    RETURN NEXT;
    RETURN;
  END IF;

  UPDATE public.profiles SET coins = coins + _fixed_reward WHERE id = _uid;
  INSERT INTO public.coin_transactions(user_id, amount, reason, ref_id)
  VALUES (_uid, _fixed_reward, 'alarm', _alarm_id);

  SELECT p.coins INTO coins FROM public.profiles p WHERE p.id = _uid;
  awarded := _fixed_reward;
  RETURN NEXT;
END; $function$;

-- ==== 20260728005117_6c2663aa-b865-462c-9311-f6b421f53d19.sql ====
DROP POLICY IF EXISTS "avatars read" ON storage.objects;
CREATE POLICY "avatars read own" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = (auth.uid())::text);

-- ==== 20260729073633_892b2106-c502-4e69-ae8a-bcbc7f1c135f.sql ====
-- 1) Cap task points so complete_task cannot mint unlimited coins
UPDATE public.tasks SET pts = 50 WHERE pts > 50;
ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_pts_bounds CHECK (pts >= 0 AND pts <= 50);

-- 2) Guard economy columns on profiles: only trusted RPCs may change them
CREATE OR REPLACE FUNCTION public.guard_profile_economy()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF coalesce(current_setting('app.economy_write', true), 'off') <> 'on' THEN
    NEW.coins := OLD.coins;
    NEW.streak := OLD.streak;
    NEW.longest_streak := OLD.longest_streak;
    NEW.last_activity_date := OLD.last_activity_date;
    NEW.last_penalty_date := OLD.last_penalty_date;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_profile_economy_trg ON public.profiles;
CREATE TRIGGER guard_profile_economy_trg
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_economy();

-- 3) Re-create economy RPCs so they flag legitimate writes

CREATE OR REPLACE FUNCTION public.complete_task(_task_id uuid)
 RETURNS TABLE(coins integer, streak integer, longest_streak integer, awarded integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _pts integer;
  _today date := (now() AT TIME ZONE 'utc')::date;
  _last date;
  _new_streak integer;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  PERFORM set_config('app.economy_write', 'on', true);

  SELECT LEAST(GREATEST(t.pts, 0), 50) INTO _pts FROM public.tasks t WHERE t.id = _task_id AND t.user_id = _uid AND t.is_active;
  IF _pts IS NULL THEN RAISE EXCEPTION 'task not found'; END IF;

  INSERT INTO public.task_completions(user_id, task_id, completed_on, coins_awarded)
  VALUES (_uid, _task_id, _today, _pts)
  ON CONFLICT (user_id, task_id, completed_on) DO NOTHING;

  IF NOT FOUND THEN
    SELECT p.coins, p.streak, p.longest_streak INTO coins, streak, longest_streak FROM public.profiles p WHERE p.id = _uid;
    awarded := 0;
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT last_activity_date INTO _last FROM public.profiles WHERE id = _uid;
  IF _last = _today THEN
    SELECT p.streak INTO _new_streak FROM public.profiles p WHERE p.id = _uid;
  ELSIF _last = _today - 1 THEN
    SELECT p.streak + 1 INTO _new_streak FROM public.profiles p WHERE p.id = _uid;
  ELSE
    _new_streak := 1;
  END IF;

  UPDATE public.profiles
    SET coins = coins + _pts,
        streak = _new_streak,
        longest_streak = GREATEST(longest_streak, _new_streak),
        last_activity_date = _today
    WHERE id = _uid;

  INSERT INTO public.coin_transactions(user_id, amount, reason, ref_id)
  VALUES (_uid, _pts, 'task', _task_id);

  SELECT p.coins, p.streak, p.longest_streak INTO coins, streak, longest_streak FROM public.profiles p WHERE p.id = _uid;
  awarded := _pts;
  RETURN NEXT;
END; $function$;

CREATE OR REPLACE FUNCTION public.complete_alarm(_alarm_id uuid, _reward integer DEFAULT 10)
 RETURNS TABLE(coins integer, awarded integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _today date := (now() AT TIME ZONE 'utc')::date;
  _fixed_reward constant integer := 10;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  PERFORM set_config('app.economy_write', 'on', true);

  PERFORM 1 FROM public.alarms WHERE id = _alarm_id AND user_id = _uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'alarm not found'; END IF;

  INSERT INTO public.alarm_sessions(user_id, alarm_id, completed_on, coins_awarded)
  VALUES (_uid, _alarm_id, _today, _fixed_reward)
  ON CONFLICT (user_id, alarm_id, completed_on) DO NOTHING;

  IF NOT FOUND THEN
    SELECT p.coins INTO coins FROM public.profiles p WHERE p.id = _uid;
    awarded := 0;
    RETURN NEXT;
    RETURN;
  END IF;

  UPDATE public.profiles SET coins = coins + _fixed_reward WHERE id = _uid;
  INSERT INTO public.coin_transactions(user_id, amount, reason, ref_id)
  VALUES (_uid, _fixed_reward, 'alarm', _alarm_id);

  SELECT p.coins INTO coins FROM public.profiles p WHERE p.id = _uid;
  awarded := _fixed_reward;
  RETURN NEXT;
END; $function$;

CREATE OR REPLACE FUNCTION public.apply_daily_penalty()
 RETURNS TABLE(coins integer, penalized boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _yesterday date := ((now() AT TIME ZONE 'utc')::date) - 1;
  _last_pen date;
  _total int;
  _done int;
  _new_coins int;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  PERFORM set_config('app.economy_write', 'on', true);

  SELECT last_penalty_date, p.coins INTO _last_pen, _new_coins FROM public.profiles p WHERE p.id = _uid;
  IF _last_pen IS NOT NULL AND _last_pen >= _yesterday THEN
    coins := _new_coins; penalized := false; RETURN NEXT; RETURN;
  END IF;

  SELECT count(*) INTO _total FROM public.tasks WHERE user_id = _uid AND is_active;
  IF _total = 0 THEN
    UPDATE public.profiles SET last_penalty_date = _yesterday WHERE id = _uid;
    coins := _new_coins; penalized := false; RETURN NEXT; RETURN;
  END IF;

  SELECT count(*) INTO _done FROM public.task_completions WHERE user_id = _uid AND completed_on = _yesterday;

  IF _done < _total THEN
    _new_coins := GREATEST(0, _new_coins - 3);
    UPDATE public.profiles SET coins = _new_coins, last_penalty_date = _yesterday WHERE id = _uid;
    INSERT INTO public.coin_transactions(user_id, amount, reason) VALUES (_uid, -3, 'penalty');
    coins := _new_coins; penalized := true; RETURN NEXT; RETURN;
  END IF;

  UPDATE public.profiles SET last_penalty_date = _yesterday WHERE id = _uid;
  coins := _new_coins; penalized := false; RETURN NEXT;
END; $function$;

-- ==== 20260729073659_5b5f2436-e0ed-43cd-be2e-803cc722dfbc.sql ====
REVOKE ALL ON FUNCTION public.guard_profile_economy() FROM PUBLIC, anon, authenticated;

-- ==== 20260729115600_a822a3b4-4a25-403a-b472-bb7c9fdf5fcc.sql ====
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.tasks (user_id, icon, name, pts, sort_order) VALUES
    (NEW.id, '🌅', 'Wake Up 4AM',  10, 1),
    (NEW.id, '💪', 'Workout',      15, 2),
    (NEW.id, '📚', 'Deep Focus',    8, 3),
    (NEW.id, '🍔', 'No Junk Food', 15, 4);

  RETURN NEW;
END;
$$;

UPDATE public.tasks SET is_active = false
WHERE is_active = true
  AND name NOT IN ('Wake Up 4AM', 'Workout', 'Deep Focus', 'No Junk Food');

UPDATE public.tasks SET sort_order = CASE name
    WHEN 'Wake Up 4AM' THEN 1
    WHEN 'Workout' THEN 2
    WHEN 'Deep Focus' THEN 3
    WHEN 'No Junk Food' THEN 4
  END
WHERE is_active = true AND name IN ('Wake Up 4AM', 'Workout', 'Deep Focus', 'No Junk Food');

-- ==== 20260729120155_bf285adc-cf9a-4855-9921-afbbc9f1182d.sql ====
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.tasks (user_id, icon, name, pts, sort_order) VALUES
    (NEW.id, '🌅', 'Wake Up 4AM',  21, 1),
    (NEW.id, '🚿', 'Cold Shower',  10, 2),
    (NEW.id, '💪', 'Workout',      15, 3),
    (NEW.id, '📚', 'Deep Focus',    8, 4),
    (NEW.id, '🍔', 'No Junk Food', 15, 5);

  RETURN NEW;
END;
$$;

-- ==== 20260729133603_a42c6d8b-71c9-462c-b0d4-fcf0599154d7.sql ====
CREATE OR REPLACE FUNCTION public.complete_task(_task_id uuid)
 RETURNS TABLE(coins integer, streak integer, longest_streak integer, awarded integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _pts integer;
  _today date := (now() AT TIME ZONE 'utc')::date;
  _last date;
  _new_streak integer;
  _inserted boolean := false;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  PERFORM set_config('app.economy_write', 'on', true);

  SELECT LEAST(GREATEST(t.pts, 0), 50) INTO _pts FROM public.tasks t WHERE t.id = _task_id AND t.user_id = _uid AND t.is_active;
  IF _pts IS NULL THEN RAISE EXCEPTION 'task not found'; END IF;

  INSERT INTO public.task_completions(user_id, task_id, completed_on, coins_awarded)
  VALUES (_uid, _task_id, _today, _pts)
  ON CONFLICT (user_id, task_id, completed_on) DO NOTHING;

  GET DIAGNOSTICS _inserted = ROW_COUNT;

  IF NOT _inserted THEN
    SELECT p.coins, p.streak, p.longest_streak INTO coins, streak, longest_streak FROM public.profiles p WHERE p.id = _uid;
    awarded := 0;
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT p.last_activity_date INTO _last FROM public.profiles p WHERE p.id = _uid;
  IF _last = _today THEN
    SELECT p.streak INTO _new_streak FROM public.profiles p WHERE p.id = _uid;
  ELSIF _last = _today - 1 THEN
    SELECT p.streak + 1 INTO _new_streak FROM public.profiles p WHERE p.id = _uid;
  ELSE
    _new_streak := 1;
  END IF;

  UPDATE public.profiles p
    SET coins = p.coins + _pts,
        streak = _new_streak,
        longest_streak = GREATEST(p.longest_streak, _new_streak),
        last_activity_date = _today
    WHERE p.id = _uid;

  INSERT INTO public.coin_transactions(user_id, amount, reason, ref_id)
  VALUES (_uid, _pts, 'task', _task_id);

  SELECT p.coins, p.streak, p.longest_streak INTO coins, streak, longest_streak FROM public.profiles p WHERE p.id = _uid;
  awarded := _pts;
  RETURN NEXT;
END; $function$;

CREATE OR REPLACE FUNCTION public.complete_alarm(_alarm_id uuid, _reward integer DEFAULT 10)
 RETURNS TABLE(coins integer, awarded integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _today date := (now() AT TIME ZONE 'utc')::date;
  _fixed_reward constant integer := 10;
  _inserted boolean := false;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  PERFORM set_config('app.economy_write', 'on', true);

  PERFORM 1 FROM public.alarms a WHERE a.id = _alarm_id AND a.user_id = _uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'alarm not found'; END IF;

  INSERT INTO public.alarm_sessions(user_id, alarm_id, completed_on, coins_awarded)
  VALUES (_uid, _alarm_id, _today, _fixed_reward)
  ON CONFLICT (user_id, alarm_id, completed_on) DO NOTHING;

  GET DIAGNOSTICS _inserted = ROW_COUNT;

  IF NOT _inserted THEN
    SELECT p.coins INTO coins FROM public.profiles p WHERE p.id = _uid;
    awarded := 0;
    RETURN NEXT;
    RETURN;
  END IF;

  UPDATE public.profiles p SET coins = p.coins + _fixed_reward WHERE p.id = _uid;
  INSERT INTO public.coin_transactions(user_id, amount, reason, ref_id)
  VALUES (_uid, _fixed_reward, 'alarm', _alarm_id);

  SELECT p.coins INTO coins FROM public.profiles p WHERE p.id = _uid;
  awarded := _fixed_reward;
  RETURN NEXT;
END; $function$;

CREATE OR REPLACE FUNCTION public.apply_daily_penalty()
 RETURNS TABLE(coins integer, penalized boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _yesterday date := ((now() AT TIME ZONE 'utc')::date) - 1;
  _last_pen date;
  _total int;
  _done int;
  _new_coins int;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  PERFORM set_config('app.economy_write', 'on', true);

  SELECT p.last_penalty_date, p.coins INTO _last_pen, _new_coins FROM public.profiles p WHERE p.id = _uid;
  IF _last_pen IS NOT NULL AND _last_pen >= _yesterday THEN
    coins := _new_coins; penalized := false; RETURN NEXT; RETURN;
  END IF;

  SELECT count(*) INTO _total FROM public.tasks t WHERE t.user_id = _uid AND t.is_active;
  IF _total = 0 THEN
    UPDATE public.profiles p SET last_penalty_date = _yesterday WHERE p.id = _uid;
    coins := _new_coins; penalized := false; RETURN NEXT; RETURN;
  END IF;

  SELECT count(*) INTO _done FROM public.task_completions tc WHERE tc.user_id = _uid AND tc.completed_on = _yesterday;

  IF _done < _total THEN
    _new_coins := GREATEST(0, _new_coins - 3);
    UPDATE public.profiles p SET coins = _new_coins, last_penalty_date = _yesterday WHERE p.id = _uid;
    INSERT INTO public.coin_transactions(user_id, amount, reason) VALUES (_uid, -3, 'penalty');
    coins := _new_coins; penalized := true; RETURN NEXT; RETURN;
  END IF;

  UPDATE public.profiles p SET last_penalty_date = _yesterday WHERE p.id = _uid;
  coins := _new_coins; penalized := false; RETURN NEXT;
END; $function$;

-- ==== 20260729154057_c331207a-8547-446d-964a-2d67c68b25a6.sql ====
REVOKE ALL ON FUNCTION public.complete_alarm(uuid, integer) FROM anon, authenticated, PUBLIC;
REVOKE ALL ON FUNCTION public.has_active_subscription(uuid, text) FROM anon, authenticated, PUBLIC;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon, authenticated, PUBLIC;
REVOKE ALL ON FUNCTION public.guard_profile_economy() FROM anon, authenticated, PUBLIC;
REVOKE ALL ON FUNCTION public.force_app_trial_window() FROM anon, authenticated, PUBLIC;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM anon, authenticated, PUBLIC;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM anon, authenticated, PUBLIC;

REVOKE ALL ON FUNCTION public.complete_task(uuid) FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION public.apply_daily_penalty() FROM anon, PUBLIC;
REVOKE ALL ON FUNCTION public.ensure_app_trial() FROM anon, PUBLIC;

GRANT EXECUTE ON FUNCTION public.complete_task(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_daily_penalty() TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_app_trial() TO authenticated;

-- ==== 20260729154407_c64f783f-35ef-432b-a5de-c56a92f5278e.sql ====
-- TASKS
DROP POLICY IF EXISTS "own tasks all" ON public.tasks;
CREATE POLICY "tasks_select_own" ON public.tasks FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "tasks_insert_own" ON public.tasks FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tasks_update_own" ON public.tasks FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tasks_delete_own" ON public.tasks FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- TASK COMPLETIONS
DROP POLICY IF EXISTS "own completions" ON public.task_completions;
CREATE POLICY "task_completions_select_own" ON public.task_completions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "task_completions_insert_own" ON public.task_completions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "task_completions_update_own" ON public.task_completions FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "task_completions_delete_own" ON public.task_completions FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ALARMS
DROP POLICY IF EXISTS "own alarms" ON public.alarms;
CREATE POLICY "alarms_select_own" ON public.alarms FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "alarms_insert_own" ON public.alarms FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "alarms_update_own" ON public.alarms FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "alarms_delete_own" ON public.alarms FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ALARM SESSIONS
DROP POLICY IF EXISTS "own alarm sessions" ON public.alarm_sessions;
CREATE POLICY "alarm_sessions_select_own" ON public.alarm_sessions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "alarm_sessions_insert_own" ON public.alarm_sessions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "alarm_sessions_update_own" ON public.alarm_sessions FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "alarm_sessions_delete_own" ON public.alarm_sessions FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- PROFILES (owner column is id)
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_delete_own" ON public.profiles FOR DELETE TO authenticated USING (auth.uid() = id);

-- SUBSCRIPTIONS (billing-owned: owner read only, system writes)
DROP POLICY IF EXISTS "Users can view own subscription" ON public.subscriptions;
DROP POLICY IF EXISTS "Service role manages subscriptions" ON public.subscriptions;
CREATE POLICY "subscriptions_select_own" ON public.subscriptions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "subscriptions_service_all" ON public.subscriptions FOR ALL TO service_role USING (auth.uid() IS NULL OR auth.uid() = user_id) WITH CHECK (true);

-- PAYMENT EVENTS (webhook-owned: owner read only, system writes)
DROP POLICY IF EXISTS "Users can view own payment events" ON public.payment_events;
DROP POLICY IF EXISTS "Service role manages payment events" ON public.payment_events;
CREATE POLICY "payment_events_select_own" ON public.payment_events FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "payment_events_service_all" ON public.payment_events FOR ALL TO service_role USING (auth.uid() IS NULL OR auth.uid() = user_id) WITH CHECK (true);

-- COIN TRANSACTIONS (append-only ledger, owner read only)
DROP POLICY IF EXISTS "own coin tx" ON public.coin_transactions;
CREATE POLICY "coin_transactions_select_own" ON public.coin_transactions FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- APP TRIALS (owner read + one-time start, no self-service edit/delete)
DROP POLICY IF EXISTS "Users can view own app trial" ON public.app_trials;
DROP POLICY IF EXISTS "Users can start own app trial" ON public.app_trials;
CREATE POLICY "app_trials_select_own" ON public.app_trials FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "app_trials_insert_own" ON public.app_trials FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alarms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alarm_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coin_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_trials ENABLE ROW LEVEL SECURITY;

-- ==== 20260730162225_447072be-928e-485b-a3d2-dd9fc082a8ad.sql ====
DELETE FROM public.payment_events;
DELETE FROM public.subscriptions;

ALTER TABLE public.subscriptions RENAME COLUMN paddle_subscription_id TO stripe_subscription_id;
ALTER TABLE public.subscriptions RENAME COLUMN paddle_customer_id TO stripe_customer_id;
ALTER TABLE public.payment_events RENAME COLUMN paddle_event_id TO provider_event_id;

-- ==== 20260802111715_2ee7a7b3-8bea-409d-86e2-6c7f1e824774.sql ====
-- 1. Make Stripe-specific columns optional
ALTER TABLE public.subscriptions
  ALTER COLUMN stripe_subscription_id DROP NOT NULL,
  ALTER COLUMN stripe_customer_id DROP NOT NULL,
  ALTER COLUMN product_id DROP NOT NULL;

-- 2. Provider-agnostic columns
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'razorpay',
  ADD COLUMN IF NOT EXISTS provider_subscription_id text,
  ADD COLUMN IF NOT EXISTS provider_customer_id text,
  ADD COLUMN IF NOT EXISTS short_url text;

-- Backfill existing rows as stripe
UPDATE public.subscriptions
  SET provider = 'stripe',
      provider_subscription_id = COALESCE(provider_subscription_id, stripe_subscription_id),
      provider_customer_id = COALESCE(provider_customer_id, stripe_customer_id)
  WHERE provider_subscription_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_provider_sub_uidx
  ON public.subscriptions (provider, provider_subscription_id)
  WHERE provider_subscription_id IS NOT NULL;

-- 3. Razorpay plan cache
CREATE TABLE public.billing_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'razorpay',
  environment text NOT NULL,
  price_key text NOT NULL,
  plan_id text NOT NULL,
  amount integer NOT NULL,
  currency text NOT NULL,
  period text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX billing_plans_key_uidx
  ON public.billing_plans (provider, environment, price_key);

GRANT ALL ON public.billing_plans TO service_role;

ALTER TABLE public.billing_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY billing_plans_service_all ON public.billing_plans
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TRIGGER billing_plans_set_updated_at
  BEFORE UPDATE ON public.billing_plans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ==== 20260802112750_85ee732a-4344-41ac-8e2a-2f039f8ddb2c.sql ====
DROP INDEX IF EXISTS public.subscriptions_provider_sub_uidx;
DROP INDEX IF EXISTS public.idx_subscriptions_paddle_id;

ALTER TABLE public.subscriptions
  DROP COLUMN IF EXISTS stripe_subscription_id,
  DROP COLUMN IF EXISTS stripe_customer_id;

DELETE FROM public.subscriptions WHERE provider_subscription_id IS NULL;

ALTER TABLE public.subscriptions
  ALTER COLUMN provider_subscription_id SET NOT NULL;

ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_provider_sub_key UNIQUE (provider, provider_subscription_id);

-- ==== 20260808202528_ec2c9359-b634-4067-a3f2-a17f18f3ce22.sql ====
CREATE TABLE public.focus_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tier text NOT NULL,
  minutes integer NOT NULL,
  coins_awarded integer NOT NULL DEFAULT 0,
  lock_mode text NOT NULL DEFAULT 'strict',
  blocked_apps text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.focus_sessions TO authenticated;
GRANT ALL ON public.focus_sessions TO service_role;

ALTER TABLE public.focus_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY focus_sessions_select_own ON public.focus_sessions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE INDEX focus_sessions_user_created_idx ON public.focus_sessions (user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.complete_focus_session(_tier text, _lock_mode text DEFAULT 'strict', _blocked_apps text[] DEFAULT '{}')
RETURNS TABLE(coins integer, awarded integer, minutes integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _pts integer;
  _mins integer;
  _last timestamptz;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  IF _tier = 'f49' THEN _pts := 15; _mins := 49;
  ELSIF _tier = 'f120' THEN _pts := 25; _mins := 120;
  ELSIF _tier = 'f229' THEN _pts := 40; _mins := 229;
  ELSE RAISE EXCEPTION 'invalid tier';
  END IF;

  -- anti-abuse: a session cannot be credited faster than its own duration
  SELECT max(fs.created_at) INTO _last FROM public.focus_sessions fs WHERE fs.user_id = _uid;
  IF _last IS NOT NULL AND _last > now() - (_mins || ' minutes')::interval THEN
    RAISE EXCEPTION 'focus session too soon';
  END IF;

  PERFORM set_config('app.economy_write', 'on', true);

  INSERT INTO public.focus_sessions(user_id, tier, minutes, coins_awarded, lock_mode, blocked_apps)
  VALUES (_uid, _tier, _mins, _pts, coalesce(_lock_mode, 'strict'), coalesce(_blocked_apps, '{}'));

  UPDATE public.profiles p SET coins = p.coins + _pts WHERE p.id = _uid;
  INSERT INTO public.coin_transactions(user_id, amount, reason) VALUES (_uid, _pts, 'focus');

  SELECT p.coins INTO coins FROM public.profiles p WHERE p.id = _uid;
  awarded := _pts;
  minutes := _mins;
  RETURN NEXT;
END; $$;

REVOKE ALL ON FUNCTION public.complete_focus_session(text, text, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_focus_session(text, text, text[]) TO authenticated;

-- ==== 20260809050414_d5ac0272-1093-430b-9c99-70acf9dfdb0c.sql ====
CREATE OR REPLACE FUNCTION public.enforce_task_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _count int;
BEGIN
  SELECT count(*) INTO _count FROM public.tasks t WHERE t.user_id = NEW.user_id AND t.is_active;
  IF _count >= 12 THEN
    RAISE EXCEPTION 'task limit reached';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_task_limit_trg ON public.tasks;
CREATE TRIGGER enforce_task_limit_trg
BEFORE INSERT ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.enforce_task_limit();

CREATE OR REPLACE FUNCTION public.complete_task(_task_id uuid)
 RETURNS TABLE(coins integer, streak integer, longest_streak integer, awarded integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _pts integer;
  _today date := (now() AT TIME ZONE 'utc')::date;
  _last date;
  _new_streak integer;
  _inserted boolean := false;
  _daily_cap constant integer := 120;
  _awarded_today integer;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  PERFORM set_config('app.economy_write', 'on', true);

  SELECT LEAST(GREATEST(t.pts, 0), 50) INTO _pts FROM public.tasks t WHERE t.id = _task_id AND t.user_id = _uid AND t.is_active;
  IF _pts IS NULL THEN RAISE EXCEPTION 'task not found'; END IF;

  SELECT COALESCE(sum(tc.coins_awarded), 0) INTO _awarded_today
    FROM public.task_completions tc
    WHERE tc.user_id = _uid AND tc.completed_on = _today;

  _pts := LEAST(_pts, GREATEST(_daily_cap - _awarded_today, 0));

  INSERT INTO public.task_completions(user_id, task_id, completed_on, coins_awarded)
  VALUES (_uid, _task_id, _today, _pts)
  ON CONFLICT (user_id, task_id, completed_on) DO NOTHING;

  GET DIAGNOSTICS _inserted = ROW_COUNT;

  IF NOT _inserted THEN
    SELECT p.coins, p.streak, p.longest_streak INTO coins, streak, longest_streak FROM public.profiles p WHERE p.id = _uid;
    awarded := 0;
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT p.last_activity_date INTO _last FROM public.profiles p WHERE p.id = _uid;
  IF _last = _today THEN
    SELECT p.streak INTO _new_streak FROM public.profiles p WHERE p.id = _uid;
  ELSIF _last = _today - 1 THEN
    SELECT p.streak + 1 INTO _new_streak FROM public.profiles p WHERE p.id = _uid;
  ELSE
    _new_streak := 1;
  END IF;

  UPDATE public.profiles p
    SET coins = p.coins + _pts,
        streak = _new_streak,
        longest_streak = GREATEST(p.longest_streak, _new_streak),
        last_activity_date = _today
    WHERE p.id = _uid;

  IF _pts > 0 THEN
    INSERT INTO public.coin_transactions(user_id, amount, reason, ref_id)
    VALUES (_uid, _pts, 'task', _task_id);
  END IF;

  SELECT p.coins, p.streak, p.longest_streak INTO coins, streak, longest_streak FROM public.profiles p WHERE p.id = _uid;
  awarded := _pts;
  RETURN NEXT;
END; $function$;

REVOKE EXECUTE ON FUNCTION public.enforce_task_limit() FROM PUBLIC;

-- ==== 20260811012612_cc62047c-b86f-4444-99e9-f0212211d2e2.sql ====
REVOKE ALL ON FUNCTION public.enforce_task_limit() FROM PUBLIC, anon, authenticated;

-- ==== 20260830083415_99daefa8-132a-4f79-a39e-41a13d1ee6e9.sql ====
-- ============ 1. profile additions: shields, onboarding, referrals ============
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS shields integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS onboarded boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS referral_code text,
  ADD COLUMN IF NOT EXISTS referred_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_referral_code_key ON public.profiles(referral_code) WHERE referral_code IS NOT NULL;

-- protect new economy columns from direct client writes
CREATE OR REPLACE FUNCTION public.guard_profile_economy()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
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
  END IF;
  RETURN NEW;
END;
$function$;

-- ============ 2. streak shield uses (idempotency ledger) ============
CREATE TABLE IF NOT EXISTS public.streak_shield_uses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  used_for date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, used_for)
);
GRANT SELECT ON public.streak_shield_uses TO authenticated;
GRANT ALL ON public.streak_shield_uses TO service_role;
ALTER TABLE public.streak_shield_uses ENABLE ROW LEVEL SECURITY;
CREATE POLICY shield_uses_select_own ON public.streak_shield_uses FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- ============ 3. habit reminders ============
CREATE TABLE IF NOT EXISTS public.habit_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  remind_at time NOT NULL DEFAULT '07:00',
  timezone text NOT NULL DEFAULT 'UTC',
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, task_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.habit_reminders TO authenticated;
GRANT ALL ON public.habit_reminders TO service_role;
ALTER TABLE public.habit_reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY habit_reminders_select_own ON public.habit_reminders FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY habit_reminders_insert_own ON public.habit_reminders FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY habit_reminders_update_own ON public.habit_reminders FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY habit_reminders_delete_own ON public.habit_reminders FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER habit_reminders_updated_at BEFORE UPDATE ON public.habit_reminders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ 4. friendships ============
CREATE TABLE IF NOT EXISTS public.friendships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  addressee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (requester_id <> addressee_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS friendships_pair_key
  ON public.friendships (LEAST(requester_id, addressee_id), GREATEST(requester_id, addressee_id));
GRANT SELECT ON public.friendships TO authenticated;
GRANT ALL ON public.friendships TO service_role;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
CREATE POLICY friendships_select_involved ON public.friendships FOR SELECT TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

-- ============ 5. shield economy functions ============
CREATE OR REPLACE FUNCTION public.buy_streak_shield()
RETURNS TABLE(coins integer, shields integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  _uid uuid := auth.uid();
  _cost constant integer := 150;
  _max constant integer := 3;
  _coins integer; _shields integer;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  PERFORM set_config('app.economy_write', 'on', true);

  SELECT p.coins, p.shields INTO _coins, _shields FROM public.profiles p WHERE p.id = _uid FOR UPDATE;
  IF _shields >= _max THEN RAISE EXCEPTION 'shield limit reached'; END IF;
  IF _coins < _cost THEN RAISE EXCEPTION 'not enough coins'; END IF;

  UPDATE public.profiles p SET coins = p.coins - _cost, shields = p.shields + 1 WHERE p.id = _uid
    RETURNING p.coins, p.shields INTO _coins, _shields;
  INSERT INTO public.coin_transactions(user_id, amount, reason) VALUES (_uid, -_cost, 'shield_purchase');

  coins := _coins; shields := _shields; RETURN NEXT;
END; $$;

CREATE OR REPLACE FUNCTION public.use_streak_shield()
RETURNS TABLE(shields integer, applied boolean, reason text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  _uid uuid := auth.uid();
  _yesterday date := ((now() AT TIME ZONE 'utc')::date) - 1;
  _shields integer; _last date; _total int; _done int;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  PERFORM set_config('app.economy_write', 'on', true);

  SELECT p.shields, p.last_activity_date INTO _shields, _last
    FROM public.profiles p WHERE p.id = _uid FOR UPDATE;

  IF _shields IS NULL OR _shields <= 0 THEN
    shields := coalesce(_shields, 0); applied := false; reason := 'no_shields'; RETURN NEXT; RETURN;
  END IF;

  SELECT count(*) INTO _total FROM public.tasks t WHERE t.user_id = _uid AND t.is_active;
  SELECT count(*) INTO _done FROM public.task_completions tc WHERE tc.user_id = _uid AND tc.completed_on = _yesterday;
  IF _total = 0 OR _done >= _total THEN
    shields := _shields; applied := false; reason := 'nothing_to_protect'; RETURN NEXT; RETURN;
  END IF;

  IF _last IS NULL OR _last >= _yesterday OR _last < _yesterday - 1 THEN
    shields := _shields; applied := false; reason := 'no_streak_at_risk'; RETURN NEXT; RETURN;
  END IF;

  BEGIN
    INSERT INTO public.streak_shield_uses(user_id, used_for) VALUES (_uid, _yesterday);
  EXCEPTION WHEN unique_violation THEN
    shields := _shields; applied := false; reason := 'already_used'; RETURN NEXT; RETURN;
  END;

  UPDATE public.profiles p
    SET shields = p.shields - 1,
        last_activity_date = _yesterday,
        last_penalty_date = GREATEST(coalesce(p.last_penalty_date, _yesterday), _yesterday)
    WHERE p.id = _uid
    RETURNING p.shields INTO _shields;

  shields := _shields; applied := true; reason := 'protected'; RETURN NEXT;
END; $$;

-- ============ 6. referrals ============
CREATE OR REPLACE FUNCTION public.get_or_create_referral_code()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  _uid uuid := auth.uid();
  _code text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT p.referral_code INTO _code FROM public.profiles p WHERE p.id = _uid;
  IF _code IS NOT NULL THEN RETURN _code; END IF;

  PERFORM set_config('app.economy_write', 'on', true);
  FOR i IN 1..8 LOOP
    _code := 'AXEN' || upper(substr(encode(gen_random_bytes(5), 'hex'), 1, 6));
    BEGIN
      UPDATE public.profiles p SET referral_code = _code WHERE p.id = _uid;
      RETURN _code;
    EXCEPTION WHEN unique_violation THEN
      NULL;
    END;
  END LOOP;
  RAISE EXCEPTION 'could not allocate referral code';
END; $$;

CREATE OR REPLACE FUNCTION public.redeem_referral_code(_code text)
RETURNS TABLE(coins integer, applied boolean, reason text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  _uid uuid := auth.uid();
  _bonus constant integer := 50;
  _referrer uuid;
  _existing uuid;
  _created timestamptz;
  _coins integer;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  PERFORM set_config('app.economy_write', 'on', true);

  SELECT p.referred_by, p.created_at, p.coins INTO _existing, _created, _coins
    FROM public.profiles p WHERE p.id = _uid FOR UPDATE;

  IF _existing IS NOT NULL THEN
    coins := _coins; applied := false; reason := 'already_referred'; RETURN NEXT; RETURN;
  END IF;
  IF _created < now() - interval '14 days' THEN
    coins := _coins; applied := false; reason := 'account_too_old'; RETURN NEXT; RETURN;
  END IF;

  SELECT p.id INTO _referrer FROM public.profiles p WHERE p.referral_code = upper(trim(_code));
  IF _referrer IS NULL THEN
    coins := _coins; applied := false; reason := 'invalid_code'; RETURN NEXT; RETURN;
  END IF;
  IF _referrer = _uid THEN
    coins := _coins; applied := false; reason := 'self_referral'; RETURN NEXT; RETURN;
  END IF;

  UPDATE public.profiles p SET referred_by = _referrer, coins = p.coins + _bonus
    WHERE p.id = _uid AND p.referred_by IS NULL
    RETURNING p.coins INTO _coins;
  IF _coins IS NULL THEN
    SELECT p.coins INTO _coins FROM public.profiles p WHERE p.id = _uid;
    coins := _coins; applied := false; reason := 'already_referred'; RETURN NEXT; RETURN;
  END IF;

  INSERT INTO public.coin_transactions(user_id, amount, reason, ref_id) VALUES (_uid, _bonus, 'referral_joined', _referrer);
  UPDATE public.profiles p SET coins = p.coins + _bonus WHERE p.id = _referrer;
  INSERT INTO public.coin_transactions(user_id, amount, reason, ref_id) VALUES (_referrer, _bonus, 'referral_bonus', _uid);

  coins := _coins; applied := true; reason := 'ok'; RETURN NEXT;
END; $$;

-- ============ 7. friend functions ============
CREATE OR REPLACE FUNCTION public.send_friend_request(_username text)
RETURNS TABLE(ok boolean, reason text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  _uid uuid := auth.uid();
  _target uuid;
  _row public.friendships%ROWTYPE;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  SELECT p.id INTO _target FROM public.profiles p
    WHERE lower(coalesce(p.username, '')) = lower(trim(_username))
       OR lower(coalesce(p.display_name, '')) = lower(trim(_username))
    LIMIT 1;

  IF _target IS NULL THEN ok := false; reason := 'user_not_found'; RETURN NEXT; RETURN; END IF;
  IF _target = _uid THEN ok := false; reason := 'cannot_add_yourself'; RETURN NEXT; RETURN; END IF;

  SELECT * INTO _row FROM public.friendships f
    WHERE LEAST(f.requester_id, f.addressee_id) = LEAST(_uid, _target)
      AND GREATEST(f.requester_id, f.addressee_id) = GREATEST(_uid, _target);

  IF FOUND THEN
    IF _row.status = 'accepted' THEN ok := false; reason := 'already_friends'; RETURN NEXT; RETURN; END IF;
    IF _row.status = 'pending' THEN ok := false; reason := 'request_pending'; RETURN NEXT; RETURN; END IF;
    UPDATE public.friendships f SET status = 'pending', requester_id = _uid, addressee_id = _target, updated_at = now()
      WHERE f.id = _row.id;
    ok := true; reason := 'sent'; RETURN NEXT; RETURN;
  END IF;

  INSERT INTO public.friendships(requester_id, addressee_id, status) VALUES (_uid, _target, 'pending');
  ok := true; reason := 'sent'; RETURN NEXT;
EXCEPTION WHEN unique_violation THEN
  ok := false; reason := 'request_pending'; RETURN NEXT;
END; $$;

CREATE OR REPLACE FUNCTION public.respond_friend_request(_request_id uuid, _accept boolean)
RETURNS TABLE(ok boolean, reason text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  _uid uuid := auth.uid();
  _n int;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  UPDATE public.friendships f
    SET status = CASE WHEN _accept THEN 'accepted' ELSE 'rejected' END, updated_at = now()
    WHERE f.id = _request_id AND f.addressee_id = _uid AND f.status = 'pending';
  GET DIAGNOSTICS _n = ROW_COUNT;
  ok := _n > 0; reason := CASE WHEN _n > 0 THEN 'updated' ELSE 'not_pending' END; RETURN NEXT;
END; $$;

CREATE OR REPLACE FUNCTION public.list_friends()
RETURNS TABLE(
  friendship_id uuid, friend_id uuid, display_name text, username text, avatar_url text,
  coins integer, streak integer, longest_streak integer, status text, direction text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT f.id,
         p.id,
         p.display_name,
         p.username,
         p.avatar_url,
         p.coins,
         p.streak,
         p.longest_streak,
         f.status,
         CASE WHEN f.requester_id = auth.uid() THEN 'outgoing' ELSE 'incoming' END
  FROM public.friendships f
  JOIN public.profiles p
    ON p.id = CASE WHEN f.requester_id = auth.uid() THEN f.addressee_id ELSE f.requester_id END
  WHERE auth.uid() IN (f.requester_id, f.addressee_id)
    AND f.status IN ('pending','accepted')
  ORDER BY f.status DESC, p.coins DESC;
$$;

-- ============ 8. execute grants (authenticated only) ============
REVOKE ALL ON FUNCTION public.buy_streak_shield() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.use_streak_shield() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_or_create_referral_code() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.redeem_referral_code(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.send_friend_request(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.respond_friend_request(uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_friends() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.buy_streak_shield() TO authenticated;
GRANT EXECUTE ON FUNCTION public.use_streak_shield() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_or_create_referral_code() TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_referral_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_friend_request(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_friend_request(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_friends() TO authenticated;

-- ==== 20260830084714_1495e859-ef9d-4b64-b1f4-1eb9d658760f.sql ====
CREATE OR REPLACE FUNCTION public.get_or_create_referral_code()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _code text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT p.referral_code INTO _code FROM public.profiles p WHERE p.id = _uid;
  IF _code IS NOT NULL THEN RETURN _code; END IF;

  PERFORM set_config('app.economy_write', 'on', true);
  FOR i IN 1..8 LOOP
    -- gen_random_uuid() is a core function, unlike pgcrypto's gen_random_bytes(),
    -- which is not on this function's search_path.
    _code := 'AXEN' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    BEGIN
      UPDATE public.profiles p SET referral_code = _code WHERE p.id = _uid;
      RETURN _code;
    EXCEPTION WHEN unique_violation THEN
      NULL;
    END;
  END LOOP;
  RAISE EXCEPTION 'could not allocate referral code';
END; $function$;

-- ==== 20260830105828_982a2243-6589-4e40-90cb-15ff7d61363d.sql ====
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_goal text,
  ADD COLUMN IF NOT EXISTS onboarding_blocker text,
  ADD COLUMN IF NOT EXISTS onboarding_habit_count integer,
  ADD COLUMN IF NOT EXISTS acquisition_source text,
  ADD COLUMN IF NOT EXISTS onboarding_answered_at timestamptz;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_onboarding_goal_chk;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_onboarding_goal_chk
  CHECK (onboarding_goal IS NULL OR onboarding_goal IN ('fitness','discipline','focus','quit_habit'));

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_onboarding_blocker_chk;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_onboarding_blocker_chk
  CHECK (onboarding_blocker IS NULL OR onboarding_blocker IN ('motivation','time','distraction','forget','one_missed_day'));

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_onboarding_habit_count_chk;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_onboarding_habit_count_chk
  CHECK (onboarding_habit_count IS NULL OR (onboarding_habit_count BETWEEN 1 AND 5));

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_acquisition_source_chk;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_acquisition_source_chk
  CHECK (acquisition_source IS NULL OR acquisition_source IN ('instagram','youtube','google','friend','play_store','other'));

-- ==== 20260902104227_2ee89983-f6d3-4439-b421-99d4f0a2defc.sql ====
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

-- ==== 20260902104251_da8665ac-d45f-4dee-8c53-a7ab9681c0b3.sql ====
-- Internal trigger functions must not be client-callable
REVOKE ALL ON FUNCTION public.sync_profile_subscription() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_profile_economy() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- ==== 20260903184420_39fca5e4-7e9a-428f-8d79-60a0b66e34b6.sql ====
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS gym_lat double precision,
  ADD COLUMN IF NOT EXISTS gym_lng double precision,
  ADD COLUMN IF NOT EXISTS gym_radius_m integer NOT NULL DEFAULT 150;

-- ==== 20260903200538_fde22ccc-66eb-4945-ab96-6639ff6ee415.sql ====
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

-- ==== 20260909014340_76c32782-b4dd-469c-aefd-22093e1d4242.sql ====
CREATE TABLE public.vision_verifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('gym','shower','focus')),
  source TEXT NOT NULL DEFAULT 'camera' CHECK (source IN ('camera','photo')),
  detections JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.vision_verifications TO authenticated;
GRANT ALL ON public.vision_verifications TO service_role;

ALTER TABLE public.vision_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own_verifications"
  ON public.vision_verifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "users_insert_own_verifications"
  ON public.vision_verifications FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ==== 20260909014429_73a183fc-531c-4c21-b1ab-b7de63596089.sql ====
ALTER TABLE public.vision_verifications ALTER COLUMN user_id SET DEFAULT auth.uid();

-- ==== 20260910002903_0128353c-5ee8-4edb-b0ed-b266a91339b7.sql ====
DROP POLICY IF EXISTS habit_reminders_premium_gate ON public.habit_reminders;

-- ==== 20260912072123_0072be73-fd33-48f3-8ec6-c4c71e0f6491.sql ====
CREATE TABLE public.accountability_pacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  partner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  daily_target int NOT NULL DEFAULT 3 CHECK (daily_target BETWEEN 1 AND 10),
  stake_coins int NOT NULL DEFAULT 0 CHECK (stake_coins BETWEEN 0 AND 200),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','ended')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (owner_id <> partner_id)
);
CREATE UNIQUE INDEX accountability_pacts_owner_active
  ON public.accountability_pacts(owner_id) WHERE status = 'active';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.accountability_pacts TO authenticated;
GRANT ALL ON public.accountability_pacts TO service_role;
ALTER TABLE public.accountability_pacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pact_read_participants" ON public.accountability_pacts
  FOR SELECT TO authenticated
  USING (auth.uid() = owner_id OR auth.uid() = partner_id);
CREATE POLICY "pact_owner_insert" ON public.accountability_pacts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "pact_owner_update" ON public.accountability_pacts
  FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "pact_owner_delete" ON public.accountability_pacts
  FOR DELETE TO authenticated USING (auth.uid() = owner_id);

CREATE TRIGGER accountability_pacts_updated_at
  BEFORE UPDATE ON public.accountability_pacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.pact_nudges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pact_id uuid NOT NULL REFERENCES public.accountability_pacts(id) ON DELETE CASCADE,
  from_user uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_user uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message text NOT NULL CHECK (char_length(message) BETWEEN 1 AND 200),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX pact_nudges_to_user_idx ON public.pact_nudges(to_user, created_at DESC);

GRANT SELECT, INSERT ON public.pact_nudges TO authenticated;
GRANT ALL ON public.pact_nudges TO service_role;
ALTER TABLE public.pact_nudges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "nudge_read_participants" ON public.pact_nudges
  FOR SELECT TO authenticated
  USING (auth.uid() = from_user OR auth.uid() = to_user);
CREATE POLICY "nudge_send_own" ON public.pact_nudges
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = from_user
    AND EXISTS (
      SELECT 1 FROM public.accountability_pacts p
      WHERE p.id = pact_id AND p.status = 'active'
        AND (auth.uid() = p.owner_id OR auth.uid() = p.partner_id)
        AND to_user = CASE WHEN auth.uid() = p.owner_id THEN p.partner_id ELSE p.owner_id END
    )
  );

CREATE OR REPLACE FUNCTION public.get_pact_status()
RETURNS TABLE (
  pact_id uuid,
  role text,
  daily_target int,
  stake_coins int,
  me_done_today int,
  me_total_today int,
  me_streak int,
  partner_id uuid,
  partner_name text,
  partner_avatar text,
  partner_done_today int,
  partner_total_today int,
  partner_streak int,
  last_nudge text,
  last_nudge_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH me AS (SELECT auth.uid() AS uid),
  p AS (
    SELECT ap.* FROM public.accountability_pacts ap, me
    WHERE ap.status = 'active' AND (ap.owner_id = me.uid OR ap.partner_id = me.uid)
    LIMIT 1
  ),
  other AS (
    SELECT p.id, CASE WHEN p.owner_id = (SELECT uid FROM me) THEN p.partner_id ELSE p.owner_id END AS oid FROM p
  )
  SELECT
    p.id,
    CASE WHEN p.owner_id = (SELECT uid FROM me) THEN 'owner' ELSE 'partner' END,
    p.daily_target,
    p.stake_coins,
    (SELECT count(*)::int FROM public.task_completions tc WHERE tc.user_id = (SELECT uid FROM me) AND tc.completed_on = CURRENT_DATE),
    (SELECT count(*)::int FROM public.tasks t WHERE t.user_id = (SELECT uid FROM me) AND t.is_active),
    (SELECT pr.streak FROM public.profiles pr WHERE pr.id = (SELECT uid FROM me)),
    o.oid,
    COALESCE((SELECT pr.display_name FROM public.profiles pr WHERE pr.id = o.oid),
             (SELECT pr.username FROM public.profiles pr WHERE pr.id = o.oid), 'Partner'),
    (SELECT pr.avatar_url FROM public.profiles pr WHERE pr.id = o.oid),
    (SELECT count(*)::int FROM public.task_completions tc WHERE tc.user_id = o.oid AND tc.completed_on = CURRENT_DATE),
    (SELECT count(*)::int FROM public.tasks t WHERE t.user_id = o.oid AND t.is_active),
    (SELECT pr.streak FROM public.profiles pr WHERE pr.id = o.oid),
    (SELECT n.message FROM public.pact_nudges n WHERE n.pact_id = p.id AND n.to_user = (SELECT uid FROM me) ORDER BY n.created_at DESC LIMIT 1),
    (SELECT n.created_at FROM public.pact_nudges n WHERE n.pact_id = p.id AND n.to_user = (SELECT uid FROM me) ORDER BY n.created_at DESC LIMIT 1)
  FROM p JOIN other o ON o.id = p.id
  WHERE public.has_premium_access(auth.uid());
$$;

REVOKE ALL ON FUNCTION public.get_pact_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_pact_status() TO authenticated;

CREATE OR REPLACE FUNCTION public.rank_scan()
RETURNS TABLE (
  coins int,
  coin_rank int,
  total_users int,
  percentile int,
  streak int,
  streak_rank int,
  longest_streak int,
  consistency_30d int,
  completions_30d int,
  active_habits int,
  best_habit text,
  best_habit_rate int,
  weakest_habit text,
  weakest_habit_rate int
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH me AS (SELECT auth.uid() AS uid),
  mine AS (SELECT pr.* FROM public.profiles pr, me WHERE pr.id = me.uid),
  totals AS (SELECT count(*)::int AS n FROM public.profiles),
  ranks AS (
    SELECT
      (SELECT count(*)::int + 1 FROM public.profiles pr WHERE pr.coins > (SELECT coins FROM mine)) AS coin_rank,
      (SELECT count(*)::int + 1 FROM public.profiles pr WHERE pr.streak > (SELECT streak FROM mine)) AS streak_rank
  ),
  habit_rates AS (
    SELECT t.name,
           (count(tc.id)::numeric / 30 * 100)::int AS rate
    FROM public.tasks t
    LEFT JOIN public.task_completions tc
      ON tc.task_id = t.id AND tc.completed_on >= CURRENT_DATE - 29
    WHERE t.user_id = (SELECT uid FROM me) AND t.is_active
    GROUP BY t.name
  )
  SELECT
    (SELECT coins FROM mine),
    r.coin_rank,
    t.n,
    GREATEST(1, LEAST(99, (100 - (r.coin_rank::numeric / GREATEST(t.n,1) * 100))::int)),
    (SELECT streak FROM mine),
    r.streak_rank,
    (SELECT longest_streak FROM mine),
    LEAST(100, (
      SELECT COALESCE((count(DISTINCT tc.completed_on)::numeric / 30 * 100)::int, 0)
      FROM public.task_completions tc
      WHERE tc.user_id = (SELECT uid FROM me) AND tc.completed_on >= CURRENT_DATE - 29
    )),
    (SELECT count(*)::int FROM public.task_completions tc
      WHERE tc.user_id = (SELECT uid FROM me) AND tc.completed_on >= CURRENT_DATE - 29),
    (SELECT count(*)::int FROM public.tasks tk WHERE tk.user_id = (SELECT uid FROM me) AND tk.is_active),
    (SELECT name FROM habit_rates ORDER BY rate DESC, name LIMIT 1),
    (SELECT rate FROM habit_rates ORDER BY rate DESC, name LIMIT 1),
    (SELECT name FROM habit_rates ORDER BY rate ASC, name LIMIT 1),
    (SELECT rate FROM habit_rates ORDER BY rate ASC, name LIMIT 1)
  FROM ranks r, totals t
  WHERE public.has_premium_access(auth.uid());
$$;

REVOKE ALL ON FUNCTION public.rank_scan() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rank_scan() TO authenticated;

-- ==== 20260912072938_f05b72fb-eac8-4db8-8db9-d23e295eca22.sql ====
REVOKE ALL ON FUNCTION public.get_pact_status() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rank_scan() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_pact_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.rank_scan() TO authenticated;

-- ==== 20260913084510_4c5fe91a-63b3-45ab-a496-9dc37e2ab6b7.sql ====
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

-- ==== 20260913084537_554a4f7a-a7e3-4c3a-9d24-5b5f03d5c492.sql ====
ALTER FUNCTION public.has_premium_access(uuid) SECURITY INVOKER;
ALTER FUNCTION public.get_entitlement() SECURITY INVOKER;

-- ==== 20260913093919_9e9bdf05-824e-4143-87f4-7a304bb32f6e.sql ====
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS frequency text NOT NULL DEFAULT 'daily',
  ADD COLUMN IF NOT EXISTS duration_days integer NOT NULL DEFAULT 21,
  ADD COLUMN IF NOT EXISTS started_on date NOT NULL DEFAULT CURRENT_DATE;

CREATE OR REPLACE FUNCTION public.validate_task_builder_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.frequency NOT IN ('daily', 'weekdays', 'weekends', 'weekly') THEN
    RAISE EXCEPTION 'invalid habit frequency';
  END IF;
  IF NEW.duration_days < 1 OR NEW.duration_days > 365 THEN
    RAISE EXCEPTION 'habit duration must be between 1 and 365 days';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS validate_task_builder_fields_trg ON public.tasks;
CREATE TRIGGER validate_task_builder_fields_trg
BEFORE INSERT OR UPDATE OF frequency, duration_days ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.validate_task_builder_fields();

CREATE TABLE public.goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  progress integer NOT NULL DEFAULT 0,
  target_date date,
  completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.goals TO authenticated;
GRANT ALL ON public.goals TO service_role;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY goals_select_own ON public.goals FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY goals_insert_own ON public.goals FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY goals_update_own ON public.goals FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY goals_delete_own ON public.goals FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER goals_updated_at BEFORE UPDATE ON public.goals
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.validate_goal_progress()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF length(trim(NEW.title)) < 1 OR length(NEW.title) > 120 THEN
    RAISE EXCEPTION 'goal title must be between 1 and 120 characters';
  END IF;
  IF NEW.progress < 0 OR NEW.progress > 100 THEN
    RAISE EXCEPTION 'goal progress must be between 0 and 100';
  END IF;
  IF NEW.completed THEN NEW.progress := 100; END IF;
  IF NEW.progress = 100 THEN NEW.completed := true; END IF;
  RETURN NEW;
END;
$function$;
CREATE TRIGGER validate_goal_progress_trg
BEFORE INSERT OR UPDATE ON public.goals
FOR EACH ROW EXECUTE FUNCTION public.validate_goal_progress();

ALTER TABLE public.habit_reminders
  ALTER COLUMN task_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS goal_id uuid REFERENCES public.goals(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS habit_reminders_user_goal_key
  ON public.habit_reminders(user_id, goal_id) WHERE goal_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.validate_reminder_target()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF (NEW.task_id IS NULL AND NEW.goal_id IS NULL) OR (NEW.task_id IS NOT NULL AND NEW.goal_id IS NOT NULL) THEN
    RAISE EXCEPTION 'reminder must target exactly one habit or goal';
  END IF;
  IF NEW.task_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.tasks t WHERE t.id = NEW.task_id AND t.user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'habit does not belong to user';
  END IF;
  IF NEW.goal_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.goals g WHERE g.id = NEW.goal_id AND g.user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'goal does not belong to user';
  END IF;
  RETURN NEW;
END;
$function$;
DROP TRIGGER IF EXISTS validate_reminder_target_trg ON public.habit_reminders;
CREATE TRIGGER validate_reminder_target_trg
BEFORE INSERT OR UPDATE OF user_id, task_id, goal_id ON public.habit_reminders
FOR EACH ROW EXECUTE FUNCTION public.validate_reminder_target();

-- ==== 20260913153615_887336b9-2dd8-4a0f-997d-3316812dd412.sql ====
-- 1. Shared quiz question bank
CREATE TABLE public.quiz_questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subject TEXT NOT NULL CHECK (subject IN ('math','science')),
  difficulty TEXT NOT NULL DEFAULT 'easy' CHECK (difficulty IN ('easy','medium','hard')),
  question_text TEXT NOT NULL,
  options JSONB,
  correct_answer TEXT NOT NULL,
  explanation TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.quiz_questions TO authenticated;
GRANT ALL ON public.quiz_questions TO service_role;
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed in users can read active questions"
  ON public.quiz_questions FOR SELECT TO authenticated USING (is_active);

-- 2. Attempts
CREATE TABLE public.quiz_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  alarm_id UUID,
  question_id UUID REFERENCES public.quiz_questions(id) ON DELETE SET NULL,
  subject TEXT,
  answer_given TEXT,
  correct BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX quiz_attempts_user_idx ON public.quiz_attempts(user_id, created_at DESC);
GRANT SELECT, INSERT ON public.quiz_attempts TO authenticated;
GRANT ALL ON public.quiz_attempts TO service_role;
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own attempts" ON public.quiz_attempts
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own attempts" ON public.quiz_attempts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- 3. One-time unlocks
CREATE TABLE public.unlock_rewards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  reward_key TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, reward_key)
);
GRANT SELECT, INSERT, UPDATE ON public.unlock_rewards TO authenticated;
GRANT ALL ON public.unlock_rewards TO service_role;
ALTER TABLE public.unlock_rewards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own unlocks" ON public.unlock_rewards
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users create own unlocks" ON public.unlock_rewards
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own unlocks" ON public.unlock_rewards
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 4. Coach notes
CREATE TABLE public.coach_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  note_date DATE NOT NULL DEFAULT CURRENT_DATE,
  summary_text TEXT NOT NULL,
  consistency_score INTEGER NOT NULL DEFAULT 0,
  recommended_focus TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, note_date)
);
GRANT SELECT, INSERT, UPDATE ON public.coach_notes TO authenticated;
GRANT ALL ON public.coach_notes TO service_role;
ALTER TABLE public.coach_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own coach notes" ON public.coach_notes
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users create own coach notes" ON public.coach_notes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own coach notes" ON public.coach_notes
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_unlock_rewards_updated_at BEFORE UPDATE ON public.unlock_rewards
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_coach_notes_updated_at BEFORE UPDATE ON public.coach_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed question bank
INSERT INTO public.quiz_questions (subject, difficulty, question_text, options, correct_answer, explanation) VALUES
('science','easy','Which gas do plants absorb for photosynthesis?','["Oxygen","Carbon dioxide","Nitrogen","Helium"]','Carbon dioxide',null),
('science','easy','What is the SI unit of force?','["Joule","Watt","Newton","Pascal"]','Newton',null),
('science','easy','Speed of light in vacuum is about…','["3x10^8 m/s","3x10^5 m/s","3x10^6 m/s","3x10^10 m/s"]','3x10^8 m/s',null),
('science','easy','Which organ pumps blood through the body?','["Liver","Lungs","Heart","Kidney"]','Heart',null),
('science','easy','Water freezes at…','["0 C","10 C","32 C","100 C"]','0 C',null),
('science','easy','Chemical symbol of sodium?','["S","So","Na","Sn"]','Na',null),
('science','easy','Which planet is closest to the Sun?','["Venus","Mercury","Mars","Earth"]','Mercury',null),
('science','medium','Energy stored in a stretched spring is…','["Kinetic","Thermal","Potential","Nuclear"]','Potential',null),
('science','easy','DNA carries…','["Genetic information","Oxygen","Fat","Minerals"]','Genetic information',null),
('science','medium','Acceleration due to gravity on Earth is about','["4.9 m/s2","9.8 m/s2","19.6 m/s2","1.6 m/s2"]','9.8 m/s2',null),
('science','easy','Sound cannot travel through…','["Steel","Water","Air","Vacuum"]','Vacuum',null),
('science','easy','Which particle has a negative charge?','["Proton","Neutron","Electron","Photon"]','Electron',null),
('science','easy','Unit of electric current?','["Volt","Ampere","Ohm","Watt"]','Ampere',null),
('science','medium','The powerhouse of the cell is the…','["Nucleus","Ribosome","Mitochondrion","Vacuole"]','Mitochondrion',null),
('science','easy','Pure water has a pH of about…','["3","7","9","12"]','7',null),
('math','easy','17 + 28 = ?',null,'45',null),
('math','easy','64 - 29 = ?',null,'35',null),
('math','easy','12 x 7 = ?',null,'84',null),
('math','medium','13 x 14 = ?',null,'182',null),
('math','medium','24 x 16 = ?',null,'384',null),
('math','medium','3x + 12 = 39. x = ?',null,'9',null),
('math','medium','7x - 5 = 44. x = ?',null,'7',null),
('math','hard','(28 x 9) - 37 = ?',null,'215',null),
('math','hard','(45 x 12) - 68 = ?',null,'472',null),
('math','hard','19 x 23 = ?',null,'437',null),
('math','medium','144 / 12 = ?',null,'12',null),
('math','medium','15% of 240 = ?',null,'36',null),
('math','hard','(17 x 18) + 26 = ?',null,'332',null),
('math','easy','56 + 37 = ?',null,'93',null),
('math','hard','5x + 23 = 118. x = ?',null,'19',null);

-- ==== 20260913153825_d669261c-f2ce-46b7-ab4f-07d6172f2f8c.sql ====
ALTER TABLE public.alarms DROP CONSTRAINT IF EXISTS alarms_challenge_type_check;
ALTER TABLE public.alarms ADD CONSTRAINT alarms_challenge_type_check
  CHECK (challenge_type = ANY (ARRAY['math'::text, 'physics'::text, 'science'::text, 'none'::text]));

CREATE OR REPLACE FUNCTION public.wake_slot_reward(_slot text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE upper(trim(_slot))
    WHEN '4AM' THEN 21
    WHEN '5AM' THEN 17
    WHEN '6AM' THEN 9
    WHEN '7AM' THEN 5
    ELSE 0 END;
$$;

CREATE OR REPLACE FUNCTION public.save_wake_plan(_slot text, _tone text, _mode text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _id uuid;
  _time text;
  _challenge text := CASE WHEN _mode IN ('math','science','physics') THEN _mode ELSE 'math' END;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF public.wake_slot_reward(_slot) = 0 THEN RAISE EXCEPTION 'invalid wake slot'; END IF;
  _time := CASE upper(trim(_slot))
    WHEN '4AM' THEN '04:00' WHEN '5AM' THEN '05:00'
    WHEN '6AM' THEN '06:00' ELSE '07:00' END;

  SELECT a.id INTO _id FROM public.alarms a
    WHERE a.user_id = _uid AND a.label = 'AXEN Wake Protocol' LIMIT 1;

  IF _id IS NULL THEN
    INSERT INTO public.alarms(user_id, time, label, tone, days, challenge_type, is_active)
    VALUES (_uid, _time, 'AXEN Wake Protocol', coalesce(_tone,'superloud'), '{0,1,2,3,4,5,6}', _challenge, true)
    RETURNING id INTO _id;
  ELSE
    UPDATE public.alarms
      SET time = _time, tone = coalesce(_tone,'superloud'), challenge_type = _challenge,
          is_active = true, updated_at = now()
      WHERE id = _id;
  END IF;

  RETURN _id;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_wake_protocol(_slot text, _task_id uuid DEFAULT NULL)
RETURNS TABLE(coins integer, streak integer, longest_streak integer, awarded integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _today date := (now() AT TIME ZONE 'utc')::date;
  _reward integer := public.wake_slot_reward(_slot);
  _alarm uuid;
  _inserted boolean := false;
  _last date;
  _new_streak integer;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _reward = 0 THEN RAISE EXCEPTION 'invalid wake slot'; END IF;
  PERFORM set_config('app.economy_write', 'on', true);

  _alarm := public.save_wake_plan(_slot, NULL, 'math');

  INSERT INTO public.alarm_sessions(user_id, alarm_id, completed_on, coins_awarded)
  VALUES (_uid, _alarm, _today, _reward)
  ON CONFLICT (user_id, alarm_id, completed_on) DO NOTHING;
  GET DIAGNOSTICS _inserted = ROW_COUNT;

  IF _inserted THEN
    SELECT p.last_activity_date INTO _last FROM public.profiles p WHERE p.id = _uid;
    IF _last = _today THEN
      SELECT p.streak INTO _new_streak FROM public.profiles p WHERE p.id = _uid;
    ELSIF _last = _today - 1 THEN
      SELECT p.streak + 1 INTO _new_streak FROM public.profiles p WHERE p.id = _uid;
    ELSE
      _new_streak := 1;
    END IF;

    UPDATE public.profiles p
      SET coins = p.coins + _reward,
          streak = _new_streak,
          longest_streak = GREATEST(p.longest_streak, _new_streak),
          last_activity_date = _today
      WHERE p.id = _uid;

    INSERT INTO public.coin_transactions(user_id, amount, reason, ref_id)
    VALUES (_uid, _reward, 'wake', _alarm);
  END IF;

  IF _task_id IS NOT NULL THEN
    INSERT INTO public.task_completions(user_id, task_id, completed_on, coins_awarded)
    SELECT _uid, t.id, _today, 0 FROM public.tasks t
      WHERE t.id = _task_id AND t.user_id = _uid AND t.is_active
    ON CONFLICT (user_id, task_id, completed_on) DO NOTHING;
  END IF;

  SELECT p.coins, p.streak, p.longest_streak
    INTO coins, streak, longest_streak
    FROM public.profiles p WHERE p.id = _uid;
  awarded := CASE WHEN _inserted THEN _reward ELSE 0 END;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_zen_session(_minutes integer)
RETURNS TABLE(coins integer, awarded integer, minutes integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _mins integer := LEAST(GREATEST(coalesce(_minutes, 0), 0), 60);
  _pts integer;
  _last timestamptz;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _mins < 5 THEN RAISE EXCEPTION 'session too short'; END IF;

  SELECT max(fs.created_at) INTO _last FROM public.focus_sessions fs
    WHERE fs.user_id = _uid AND fs.tier = 'zen';
  IF _last IS NOT NULL AND _last > now() - (_mins || ' minutes')::interval THEN
    RAISE EXCEPTION 'zen session too soon';
  END IF;

  _pts := LEAST(12, GREATEST(2, (_mins / 5) * 2));
  PERFORM set_config('app.economy_write', 'on', true);

  INSERT INTO public.focus_sessions(user_id, tier, minutes, coins_awarded, lock_mode, blocked_apps)
  VALUES (_uid, 'zen', _mins, _pts, 'flex', '{}');

  UPDATE public.profiles p SET coins = p.coins + _pts WHERE p.id = _uid;
  INSERT INTO public.coin_transactions(user_id, amount, reason) VALUES (_uid, _pts, 'zen');

  SELECT p.coins INTO coins FROM public.profiles p WHERE p.id = _uid;
  awarded := _pts;
  minutes := _mins;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.save_wake_plan(text, text, text) FROM public;
REVOKE ALL ON FUNCTION public.complete_wake_protocol(text, uuid) FROM public;
REVOKE ALL ON FUNCTION public.complete_zen_session(integer) FROM public;
GRANT EXECUTE ON FUNCTION public.save_wake_plan(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_wake_protocol(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_zen_session(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.wake_slot_reward(text) TO authenticated;

-- ==== 20260914094711_5030de7d-992c-4042-a415-7d6265196d96.sql ====
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS preferred_name text,
  ADD COLUMN IF NOT EXISTS age_range text,
  ADD COLUMN IF NOT EXISTS primary_goal text,
  ADD COLUMN IF NOT EXISTS first_habit text,
  ADD COLUMN IF NOT EXISTS social_hours_daily numeric(4,1),
  ADD COLUMN IF NOT EXISTS biggest_distraction text,
  ADD COLUMN IF NOT EXISTS wake_time time,
  ADD COLUMN IF NOT EXISTS sleep_time time,
  ADD COLUMN IF NOT EXISTS consistency_days integer,
  ADD COLUMN IF NOT EXISTS routine_breaker text,
  ADD COLUMN IF NOT EXISTS preferred_focus_time text,
  ADD COLUMN IF NOT EXISTS commitment_milestone integer,
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS onboarding_version integer NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS onboarding_step integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS safe_minor_mode boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS behavioral_tracking_allowed boolean NOT NULL DEFAULT true;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_age_range_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_age_range_check CHECK (age_range IS NULL OR age_range IN ('under_13','13_17','18_24','25_34','35_44','45_plus'));
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_social_hours_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_social_hours_check CHECK (social_hours_daily IS NULL OR (social_hours_daily >= 0 AND social_hours_daily <= 12));
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_consistency_days_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_consistency_days_check CHECK (consistency_days IS NULL OR (consistency_days >= 0 AND consistency_days <= 7));
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_commitment_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_commitment_check CHECK (commitment_milestone IS NULL OR commitment_milestone IN (21,60,90));
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_onboarding_step_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_onboarding_step_check CHECK (onboarding_step BETWEEN 1 AND 13);

ALTER TABLE public.habit_reminders
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS weekdays integer[] NOT NULL DEFAULT '{0,1,2,3,4,5,6}',
  ADD COLUMN IF NOT EXISTS repeat_mode text NOT NULL DEFAULT 'weekly',
  ADD COLUMN IF NOT EXISTS sound text NOT NULL DEFAULT 'default',
  ADD COLUMN IF NOT EXISTS vibration boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS snooze_minutes integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS notification_id integer,
  ADD COLUMN IF NOT EXISTS scheduling_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS scheduling_error text,
  ADD COLUMN IF NOT EXISTS last_scheduled_at timestamptz;
ALTER TABLE public.habit_reminders DROP CONSTRAINT IF EXISTS habit_reminders_repeat_mode_check;
ALTER TABLE public.habit_reminders ADD CONSTRAINT habit_reminders_repeat_mode_check CHECK (repeat_mode IN ('once','daily','weekdays','weekly'));
ALTER TABLE public.habit_reminders DROP CONSTRAINT IF EXISTS habit_reminders_snooze_check;
ALTER TABLE public.habit_reminders ADD CONSTRAINT habit_reminders_snooze_check CHECK (snooze_minutes IN (0,5,10,15,30));
ALTER TABLE public.habit_reminders DROP CONSTRAINT IF EXISTS habit_reminders_scheduling_status_check;
ALTER TABLE public.habit_reminders ADD CONSTRAINT habit_reminders_scheduling_status_check CHECK (scheduling_status IN ('pending','scheduled','failed','disabled'));
ALTER TABLE public.habit_reminders DROP CONSTRAINT IF EXISTS habit_reminders_weekdays_check;
ALTER TABLE public.habit_reminders ADD CONSTRAINT habit_reminders_weekdays_check CHECK (weekdays <@ ARRAY[0,1,2,3,4,5,6] AND cardinality(weekdays) > 0);
DROP POLICY IF EXISTS habit_reminders_premium_gate ON public.habit_reminders;
CREATE INDEX IF NOT EXISTS habit_reminders_user_enabled_time_idx ON public.habit_reminders(user_id, enabled, remind_at);

CREATE OR REPLACE FUNCTION public.enforce_reminder_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _count integer;
BEGIN
  IF NEW.user_id <> auth.uid() THEN RAISE EXCEPTION 'not authorized'; END IF;
  IF NEW.enabled AND NOT public.has_premium_access(NEW.user_id) THEN
    SELECT count(*) INTO _count FROM public.habit_reminders
      WHERE user_id = NEW.user_id AND enabled AND id <> NEW.id;
    IF _count >= 3 THEN RAISE EXCEPTION 'Basic includes up to 3 active reminders'; END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS enforce_reminder_limit_trigger ON public.habit_reminders;
CREATE TRIGGER enforce_reminder_limit_trigger BEFORE INSERT OR UPDATE OF enabled ON public.habit_reminders FOR EACH ROW EXECUTE FUNCTION public.enforce_reminder_limit();

CREATE TABLE public.coach_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL DEFAULT 'New conversation',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coach_conversations TO authenticated;
GRANT ALL ON public.coach_conversations TO service_role;
ALTER TABLE public.coach_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY coach_conversations_select_own ON public.coach_conversations FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY coach_conversations_insert_own ON public.coach_conversations FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY coach_conversations_update_own ON public.coach_conversations FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY coach_conversations_delete_own ON public.coach_conversations FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX coach_conversations_user_updated_idx ON public.coach_conversations(user_id, updated_at DESC);

CREATE TABLE public.coach_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.coach_conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('user','assistant')),
  content text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 4000),
  suggested_action jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.coach_messages TO authenticated;
GRANT ALL ON public.coach_messages TO service_role;
ALTER TABLE public.coach_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY coach_messages_select_own ON public.coach_messages FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY coach_messages_insert_own ON public.coach_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.coach_conversations c WHERE c.id = conversation_id AND c.user_id = auth.uid()));
CREATE POLICY coach_messages_delete_own ON public.coach_messages FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX coach_messages_conversation_created_idx ON public.coach_messages(conversation_id, created_at);

CREATE OR REPLACE FUNCTION public.touch_coach_conversation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN UPDATE public.coach_conversations SET updated_at = now() WHERE id = NEW.conversation_id AND user_id = NEW.user_id; RETURN NEW; END; $$;
CREATE TRIGGER touch_coach_conversation_after_message AFTER INSERT ON public.coach_messages FOR EACH ROW EXECUTE FUNCTION public.touch_coach_conversation();

ALTER TABLE public.alarms
  ADD COLUMN IF NOT EXISTS checkin_window_minutes integer NOT NULL DEFAULT 90,
  ADD COLUMN IF NOT EXISTS sleep_recommendation time,
  ADD COLUMN IF NOT EXISTS challenge_started_on date,
  ADD COLUMN IF NOT EXISTS recovery_enabled boolean NOT NULL DEFAULT true;
ALTER TABLE public.alarms DROP CONSTRAINT IF EXISTS alarms_checkin_window_check;
ALTER TABLE public.alarms ADD CONSTRAINT alarms_checkin_window_check CHECK (checkin_window_minutes BETWEEN 15 AND 120);

ALTER TABLE public.alarm_sessions
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'completed',
  ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS checked_in_at timestamptz,
  ADD COLUMN IF NOT EXISTS recovered boolean NOT NULL DEFAULT false;
ALTER TABLE public.alarm_sessions DROP CONSTRAINT IF EXISTS alarm_sessions_status_check;
ALTER TABLE public.alarm_sessions ADD CONSTRAINT alarm_sessions_status_check CHECK (status IN ('triggered','completed','missed','recovered'));
CREATE INDEX IF NOT EXISTS alarm_sessions_user_date_idx ON public.alarm_sessions(user_id, completed_on DESC);

ALTER TABLE public.focus_sessions
  ADD COLUMN IF NOT EXISTS session_token uuid,
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS ended_at timestamptz,
  ADD COLUMN IF NOT EXISTS intensity text;
CREATE UNIQUE INDEX IF NOT EXISTS focus_sessions_user_token_key ON public.focus_sessions(user_id, session_token) WHERE session_token IS NOT NULL;

CREATE OR REPLACE FUNCTION public.save_onboarding_step(_step integer, _answers jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _uid uuid := auth.uid(); _age text := nullif(_answers->>'age_range',''); _minor boolean;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _step < 1 OR _step > 13 THEN RAISE EXCEPTION 'invalid onboarding step'; END IF;
  _minor := _age IN ('under_13','13_17');
  UPDATE public.profiles SET
    preferred_name = left(nullif(_answers->>'preferred_name',''), 60),
    age_range = _age,
    acquisition_source = left(nullif(_answers->>'acquisition_source',''), 40),
    primary_goal = left(nullif(_answers->>'primary_goal',''), 40),
    first_habit = left(nullif(_answers->>'first_habit',''), 100),
    social_hours_daily = CASE WHEN _answers ? 'social_hours_daily' THEN LEAST(12, GREATEST(0, (_answers->>'social_hours_daily')::numeric)) ELSE NULL END,
    biggest_distraction = left(nullif(_answers->>'biggest_distraction',''), 40),
    wake_time = nullif(_answers->>'wake_time','')::time,
    sleep_time = nullif(_answers->>'sleep_time','')::time,
    consistency_days = CASE WHEN _answers ? 'consistency_days' THEN LEAST(7, GREATEST(0, (_answers->>'consistency_days')::integer)) ELSE NULL END,
    routine_breaker = left(nullif(_answers->>'routine_breaker',''), 40),
    preferred_focus_time = left(nullif(_answers->>'preferred_focus_time',''), 40),
    commitment_milestone = CASE WHEN (_answers->>'commitment_milestone')::integer IN (21,60,90) THEN (_answers->>'commitment_milestone')::integer ELSE NULL END,
    onboarding_step = _step,
    onboarding_version = 2,
    safe_minor_mode = _minor,
    behavioral_tracking_allowed = NOT _minor,
    updated_at = now()
  WHERE id = _uid;
END;
$$;

CREATE OR REPLACE FUNCTION public.activate_axen_plan(_answers jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _uid uuid := auth.uid(); _habit text := left(trim(coalesce(_answers->>'first_habit','')),100);
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  PERFORM public.save_onboarding_step(13, _answers);
  UPDATE public.profiles SET onboarded = true, onboarding_completed = true, onboarding_completed_at = coalesce(onboarding_completed_at, now()), onboarding_step = 13, updated_at = now() WHERE id = _uid;
  IF _habit <> '' AND NOT EXISTS (SELECT 1 FROM public.tasks WHERE user_id = _uid AND lower(name) = lower(_habit)) THEN
    INSERT INTO public.tasks(user_id, icon, name, pts, sort_order, frequency, duration_days)
    VALUES (_uid, '◎', _habit, 10, coalesce((SELECT max(sort_order)+1 FROM public.tasks WHERE user_id=_uid),1), 'daily', coalesce((_answers->>'commitment_milestone')::integer,21));
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_focus_music_session(_session_token uuid, _minutes integer, _intensity text)
RETURNS TABLE(coins integer, awarded integer, minutes integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _uid uuid := auth.uid(); _reward integer; _inserted boolean;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _session_token IS NULL OR _minutes NOT IN (25,45,60,90) THEN RAISE EXCEPTION 'invalid focus session'; END IF;
  _reward := CASE _minutes WHEN 25 THEN 5 WHEN 45 THEN 9 WHEN 60 THEN 12 ELSE 18 END;
  PERFORM set_config('app.economy_write','on',true);
  INSERT INTO public.focus_sessions(user_id,tier,minutes,coins_awarded,lock_mode,blocked_apps,session_token,started_at,ended_at,intensity)
  VALUES (_uid,'music',_minutes,_reward,'flex','{}',_session_token,now()-make_interval(mins=>_minutes),now(),CASE WHEN _intensity IN ('calm','steady','intense') THEN _intensity ELSE 'steady' END)
  ON CONFLICT (user_id,session_token) WHERE session_token IS NOT NULL DO NOTHING;
  GET DIAGNOSTICS _inserted = ROW_COUNT;
  IF _inserted THEN
    UPDATE public.profiles p SET coins=p.coins+_reward WHERE p.id=_uid;
    INSERT INTO public.coin_transactions(user_id,amount,reason,ref_id) VALUES (_uid,_reward,'focus_music',_session_token);
  END IF;
  SELECT p.coins INTO coins FROM public.profiles p WHERE p.id=_uid;
  awarded := CASE WHEN _inserted THEN _reward ELSE 0 END; minutes := _minutes; RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_wake_protocol(_slot text, _task_id uuid DEFAULT NULL)
RETURNS TABLE(coins integer, streak integer, longest_streak integer, awarded integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _uid uuid := auth.uid(); _today date := (now() AT TIME ZONE 'utc')::date; _reward integer := public.wake_slot_reward(_slot); _alarm uuid; _inserted boolean := false; _last date; _new_streak integer;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _reward = 0 THEN RAISE EXCEPTION 'invalid wake slot'; END IF;
  SELECT id INTO _alarm FROM public.alarms WHERE user_id=_uid AND label='AXEN Wake Protocol' AND is_active LIMIT 1;
  IF _alarm IS NULL THEN RAISE EXCEPTION 'wake protocol is not configured'; END IF;
  PERFORM set_config('app.economy_write','on',true);
  INSERT INTO public.alarm_sessions(user_id,alarm_id,completed_on,coins_awarded,status,checked_in_at)
  VALUES (_uid,_alarm,_today,_reward,'completed',now()) ON CONFLICT (user_id,alarm_id,completed_on) DO NOTHING;
  GET DIAGNOSTICS _inserted = ROW_COUNT;
  IF _inserted THEN
    SELECT last_activity_date INTO _last FROM public.profiles WHERE id=_uid;
    IF _last=_today THEN SELECT p.streak INTO _new_streak FROM public.profiles p WHERE p.id=_uid;
    ELSIF _last=_today-1 THEN SELECT p.streak+1 INTO _new_streak FROM public.profiles p WHERE p.id=_uid;
    ELSE _new_streak:=1; END IF;
    UPDATE public.profiles p SET coins=p.coins+_reward,streak=_new_streak,longest_streak=GREATEST(p.longest_streak,_new_streak),last_activity_date=_today WHERE p.id=_uid;
    INSERT INTO public.coin_transactions(user_id,amount,reason,ref_id) VALUES (_uid,_reward,'wake',_alarm);
  END IF;
  IF _task_id IS NOT NULL THEN INSERT INTO public.task_completions(user_id,task_id,completed_on,coins_awarded) SELECT _uid,t.id,_today,0 FROM public.tasks t WHERE t.id=_task_id AND t.user_id=_uid AND t.is_active ON CONFLICT (user_id,task_id,completed_on) DO NOTHING; END IF;
  SELECT p.coins,p.streak,p.longest_streak INTO coins,streak,longest_streak FROM public.profiles p WHERE p.id=_uid;
  awarded:=CASE WHEN _inserted THEN _reward ELSE 0 END; RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.save_onboarding_step(integer,jsonb) FROM public;
REVOKE ALL ON FUNCTION public.activate_axen_plan(jsonb) FROM public;
REVOKE ALL ON FUNCTION public.complete_focus_music_session(uuid,integer,text) FROM public;
GRANT EXECUTE ON FUNCTION public.save_onboarding_step(integer,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.activate_axen_plan(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_focus_music_session(uuid,integer,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_reminder_limit() TO authenticated;
GRANT EXECUTE ON FUNCTION public.touch_coach_conversation() TO authenticated;

-- ==== 20260914094737_02d69633-c756-4fbc-94f0-922d205ac87f.sql ====
ALTER FUNCTION public.save_onboarding_step(integer,jsonb) SECURITY INVOKER;
ALTER FUNCTION public.activate_axen_plan(jsonb) SECURITY INVOKER;
REVOKE ALL ON FUNCTION public.enforce_reminder_limit() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.touch_coach_conversation() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_focus_music_session(uuid,integer,text) FROM public, anon;
REVOKE ALL ON FUNCTION public.complete_wake_protocol(text,uuid) FROM public, anon;

-- ==== 20260914094850_21ccee76-b888-494d-b662-555a76ec655c.sql ====
REVOKE ALL ON FUNCTION public.save_wake_plan(text,text,text) FROM public, anon;
REVOKE ALL ON FUNCTION public.complete_zen_session(integer) FROM public, anon;

-- ==== 20260914111348_21381d40-52a8-4cac-9095-4590571cf019.sql ====
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

-- ==== 20260914111436_9c7a2661-18ca-499e-b66a-a4b48fb885f5.sql ====
REVOKE EXECUTE ON FUNCTION public.initialize_trial() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_entitlement() FROM anon;

DROP POLICY IF EXISTS "billing_notifications_no_client_access" ON public.billing_notifications;
CREATE POLICY "billing_notifications_no_client_access" ON public.billing_notifications
  FOR SELECT TO authenticated USING (false);

-- ==== 20260914120453_beb594d5-3640-46c3-acba-42b92c5778e6.sql ====
-- 1. Country on profile (user-editable, no GPS)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS country text NOT NULL DEFAULT 'IN';
UPDATE public.profiles SET country = 'IN' WHERE country IS NULL OR length(country) <> 2;

-- 2. Trusted, server-written score events (non-purchasable Discipline Points)
CREATE TABLE IF NOT EXISTS public.score_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  points integer NOT NULL CHECK (points > 0 AND points <= 500),
  kind text NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.score_events TO authenticated;
GRANT ALL ON public.score_events TO service_role;
ALTER TABLE public.score_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "score_events_select_own" ON public.score_events;
CREATE POLICY "score_events_select_own" ON public.score_events
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS score_events_user_time_idx ON public.score_events(user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS coin_tx_user_time_idx ON public.coin_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS coin_tx_time_idx ON public.coin_transactions(created_at DESC) WHERE amount > 0;
CREATE INDEX IF NOT EXISTS profiles_country_idx ON public.profiles(country);

-- 3. Internal scoring helper (not client callable)
CREATE OR REPLACE FUNCTION public.leaderboard_scores(_period text)
RETURNS TABLE(user_id uuid, points integer, reached_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  WITH win AS (
    SELECT CASE WHEN lower(coalesce(_period,'weekly')) = 'alltime'
                THEN '-infinity'::timestamptz
                ELSE date_trunc('week', now()) END AS since
  ),
  ct AS (
    SELECT c.user_id AS uid, sum(c.amount)::int AS pts, max(c.created_at) AS last_at
    FROM public.coin_transactions c, win w
    WHERE c.amount > 0 AND c.created_at >= w.since
    GROUP BY c.user_id
  ),
  se AS (
    SELECT s.user_id AS uid, sum(s.points)::int AS pts, max(s.occurred_at) AS last_at
    FROM public.score_events s, win w
    WHERE s.occurred_at >= w.since
    GROUP BY s.user_id
  ),
  u AS (SELECT * FROM ct UNION ALL SELECT * FROM se)
  SELECT u.uid, sum(u.pts)::int, max(u.last_at) FROM u GROUP BY u.uid;
$$;
REVOKE ALL ON FUNCTION public.leaderboard_scores(text) FROM PUBLIC, anon, authenticated;

-- 4. Top 100 leaderboard (India / Global, weekly / all-time)
CREATE OR REPLACE FUNCTION public.leaderboard_top(
  _scope text DEFAULT 'global',
  _period text DEFAULT 'weekly',
  _limit integer DEFAULT 100,
  _offset integer DEFAULT 0
)
RETURNS TABLE(
  rank integer, user_id uuid, username text, avatar_url text, country text,
  points integer, consistency integer, elite boolean, is_me boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  WITH s AS (SELECT * FROM public.leaderboard_scores(_period)),
  r AS (
    SELECT p.id,
           coalesce(nullif(trim(p.username),''), nullif(trim(p.display_name),''), 'Warrior') AS uname,
           p.avatar_url,
           upper(coalesce(nullif(p.country,''),'IN')) AS cc,
           s.points AS pts,
           greatest(p.longest_streak, p.streak) AS cons,
           s.reached_at,
           RANK() OVER (ORDER BY s.points DESC, greatest(p.longest_streak, p.streak) DESC, s.reached_at ASC)::int AS rnk
    FROM s JOIN public.profiles p ON p.id = s.user_id
    WHERE s.points > 0
      AND (lower(coalesce(_scope,'global')) <> 'india' OR upper(coalesce(nullif(p.country,''),'IN')) = 'IN')
  )
  SELECT r.rnk, r.id, r.uname, r.avatar_url, r.cc, r.pts, r.cons,
         (SELECT coalesce(sum(c.amount),0) FROM public.coin_transactions c
           WHERE c.user_id = r.id AND c.amount > 0) >= 5000,
         r.id = auth.uid()
  FROM r
  WHERE r.rnk <= 100
  ORDER BY r.rnk
  LIMIT greatest(1, least(coalesce(_limit,100), 100))
  OFFSET greatest(0, coalesce(_offset,0));
$$;
REVOKE ALL ON FUNCTION public.leaderboard_top(text,text,integer,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.leaderboard_top(text,text,integer,integer) TO authenticated;

-- 5. Current user rank + percentile + next milestone
CREATE OR REPLACE FUNCTION public.my_leaderboard_position(
  _scope text DEFAULT 'global',
  _period text DEFAULT 'weekly'
)
RETURNS TABLE(
  rank integer, total integer, percentile integer, points integer,
  consistency integer, country text, elite boolean,
  next_milestone integer, points_to_next integer, in_top100 boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  WITH me AS (SELECT auth.uid() AS uid),
  s AS (SELECT * FROM public.leaderboard_scores(_period)),
  r AS (
    SELECT p.id,
           s.points AS pts,
           greatest(p.longest_streak, p.streak) AS cons,
           upper(coalesce(nullif(p.country,''),'IN')) AS cc,
           RANK() OVER (ORDER BY s.points DESC, greatest(p.longest_streak, p.streak) DESC, s.reached_at ASC)::int AS rnk
    FROM s JOIN public.profiles p ON p.id = s.user_id
    WHERE s.points > 0
      AND (lower(coalesce(_scope,'global')) <> 'india' OR upper(coalesce(nullif(p.country,''),'IN')) = 'IN')
  ),
  tot AS (SELECT count(*)::int AS n FROM r),
  mine AS (SELECT * FROM r, me WHERE r.id = me.uid),
  milestones AS (SELECT unnest(ARRAY[100,250,500,1000,2500,5000,10000,25000,50000]) AS m)
  SELECT
    coalesce((SELECT rnk FROM mine), 0),
    (SELECT n FROM tot),
    CASE WHEN (SELECT n FROM tot) > 0 AND (SELECT rnk FROM mine) IS NOT NULL
         THEN greatest(1, least(99, (100 - ((SELECT rnk FROM mine)::numeric / (SELECT n FROM tot) * 100))::int))
         ELSE 0 END,
    coalesce((SELECT pts FROM mine), 0),
    coalesce((SELECT cons FROM mine), 0),
    coalesce((SELECT cc FROM mine), (SELECT upper(coalesce(nullif(p.country,''),'IN')) FROM public.profiles p, me WHERE p.id = me.uid), 'IN'),
    coalesce((SELECT coalesce(sum(c.amount),0) FROM public.coin_transactions c, me
               WHERE c.user_id = me.uid AND c.amount > 0), 0) >= 5000,
    coalesce((SELECT min(m) FROM milestones WHERE m > coalesce((SELECT pts FROM mine),0)), 50000),
    greatest(0, coalesce((SELECT min(m) FROM milestones WHERE m > coalesce((SELECT pts FROM mine),0)), 50000) - coalesce((SELECT pts FROM mine),0)),
    coalesce((SELECT rnk FROM mine), 9999) <= 100;
$$;
REVOKE ALL ON FUNCTION public.my_leaderboard_position(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.my_leaderboard_position(text,text) TO authenticated;

-- 6. Avatars readable by signed-in members (leaderboard photos); writes stay owner-only
DROP POLICY IF EXISTS "avatars read all authenticated" ON storage.objects;
CREATE POLICY "avatars read all authenticated" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'avatars');

-- ==== 20260916013354_190e4fde-3ea4-4ae5-941a-9cac6df9fc74.sql ====
-- 1. Starter habit rename ------------------------------------------------
UPDATE public.tasks SET name = 'Top 3 Missions', icon = '🎯', pts = 20
WHERE name = 'No Junk Food';

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
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
    (NEW.id, '🎯', 'Top 3 Missions', 20, 5);

  RETURN NEW;
END;
$function$;

-- 2. Daily top-3 tasks ----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.daily_top_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day date NOT NULL,
  slot smallint NOT NULL CHECK (slot BETWEEN 1 AND 3),
  title text NOT NULL,
  done boolean NOT NULL DEFAULT false,
  coins_awarded integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, day, slot)
);

CREATE INDEX IF NOT EXISTS daily_top_tasks_user_day_idx ON public.daily_top_tasks(user_id, day);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_top_tasks TO authenticated;
GRANT ALL ON public.daily_top_tasks TO service_role;

ALTER TABLE public.daily_top_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "daily_top_tasks_own" ON public.daily_top_tasks;
CREATE POLICY "daily_top_tasks_own" ON public.daily_top_tasks
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 3. Complete one top task (idempotent, server-priced) ---------------------
CREATE OR REPLACE FUNCTION public.complete_top_task(_slot smallint)
RETURNS TABLE(coins integer, awarded integer, all_done boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _today date := (now() AT TIME ZONE 'utc')::date;
  _row public.daily_top_tasks%ROWTYPE;
  _pts integer;
  _done_count integer;
  _task_id uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _slot NOT BETWEEN 1 AND 3 THEN RAISE EXCEPTION 'invalid slot'; END IF;
  PERFORM set_config('app.economy_write', 'on', true);

  SELECT * INTO _row FROM public.daily_top_tasks
   WHERE user_id = _uid AND day = _today AND slot = _slot FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'task not planned'; END IF;

  _pts := CASE WHEN _slot = 3 THEN 6 ELSE 7 END;

  IF _row.done THEN
    awarded := 0;
  ELSE
    UPDATE public.daily_top_tasks
       SET done = true, coins_awarded = _pts, updated_at = now()
     WHERE id = _row.id;

    UPDATE public.profiles p SET coins = p.coins + _pts WHERE p.id = _uid;
    INSERT INTO public.coin_transactions(user_id, amount, reason, ref_id)
    VALUES (_uid, _pts, 'top3', _row.id);
    awarded := _pts;
  END IF;

  SELECT count(*) INTO _done_count FROM public.daily_top_tasks
   WHERE user_id = _uid AND day = _today AND done;
  all_done := _done_count >= 3;

  IF all_done THEN
    SELECT t.id INTO _task_id FROM public.tasks t
     WHERE t.user_id = _uid AND t.is_active AND t.name = 'Top 3 Missions' LIMIT 1;
    IF _task_id IS NOT NULL THEN
      INSERT INTO public.task_completions(user_id, task_id, completed_on, coins_awarded)
      VALUES (_uid, _task_id, _today, 0)
      ON CONFLICT (user_id, task_id, completed_on) DO NOTHING;
      UPDATE public.profiles p SET last_activity_date = _today WHERE p.id = _uid;
    END IF;
  END IF;

  SELECT p.coins INTO coins FROM public.profiles p WHERE p.id = _uid;
  RETURN NEXT;
END;
$function$;

REVOKE ALL ON FUNCTION public.complete_top_task(smallint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_top_task(smallint) TO authenticated;

-- ==== 20260917003218_1475fa1b-9d47-47a1-becf-3cbace274448.sql ====
REVOKE EXECUTE ON FUNCTION public.leaderboard_top(text, text, integer, integer) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.my_leaderboard_position(text, text) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.leaderboard_top(text, text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_leaderboard_position(text, text) TO authenticated;

DROP POLICY IF EXISTS "avatars read all authenticated" ON storage.objects;

DROP POLICY IF EXISTS "coach_messages_no_update" ON public.coach_messages;
CREATE POLICY "coach_messages_no_update" ON public.coach_messages
  FOR UPDATE TO authenticated USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS "coach_messages_no_delete" ON public.coach_messages;
CREATE POLICY "coach_messages_no_delete" ON public.coach_messages
  FOR DELETE TO authenticated USING (false);

-- ==== 20260917024201_1d6f525e-f48a-44f5-b670-6a70340f16e3.sql ====
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS require_scan boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS scan_classes text[] NOT NULL DEFAULT '{}';

UPDATE public.tasks SET require_scan = true,
  scan_classes = ARRAY['book','laptop','keyboard','mouse','tv','cell phone','dining table','chair']
 WHERE cardinality(scan_classes) = 0 AND name ~* '(focus|study|read)';

UPDATE public.tasks SET require_scan = true,
  scan_classes = ARRAY['sports ball','bicycle','skateboard','tennis racket','frisbee','baseball bat','baseball glove','skis','snowboard','surfboard']
 WHERE cardinality(scan_classes) = 0 AND name ~* '(workout|gym|train|exercise)';

UPDATE public.tasks SET require_scan = true,
  scan_classes = ARRAY['toilet','sink','toothbrush','hair drier']
 WHERE cardinality(scan_classes) = 0 AND name ~* '(shower|bath|cold)';

-- ==== 20260917124256_049e45f8-1141-428f-b7d5-45c16d9a77f8.sql ====
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
    COALESCE(
      nullif(trim(NEW.raw_user_meta_data->>'display_name'), ''),
      nullif(trim(NEW.raw_user_meta_data->>'full_name'), ''),
      nullif(trim(NEW.raw_user_meta_data->>'name'), ''),
      split_part(NEW.email, '@', 1)
    ),
    now() + interval '3 days',
    false
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.tasks (user_id, icon, name, pts, sort_order) VALUES
    (NEW.id, '🌅', 'Wake Up 4AM',  21, 1),
    (NEW.id, '🚿', 'Cold Shower',  10, 2),
    (NEW.id, '💪', 'Workout',      15, 3),
    (NEW.id, '📚', 'Deep Focus',    8, 4),
    (NEW.id, '🎯', 'Top 3 Missions', 20, 5);

  RETURN NEW;
END;
$function$;

-- Leaderboard must never expose an email-looking handle
CREATE OR REPLACE FUNCTION public.leaderboard_top(_scope text DEFAULT 'global'::text, _period text DEFAULT 'weekly'::text, _limit integer DEFAULT 100, _offset integer DEFAULT 0)
 RETURNS TABLE(rank integer, user_id uuid, username text, avatar_url text, country text, points integer, consistency integer, elite boolean, is_me boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH s AS (SELECT * FROM public.leaderboard_scores(_period)),
  r AS (
    SELECT p.id,
           split_part(coalesce(nullif(trim(p.username),''), nullif(trim(p.display_name),''), 'Warrior'), '@', 1) AS uname,
           p.avatar_url,
           upper(coalesce(nullif(p.country,''),'IN')) AS cc,
           s.points AS pts,
           greatest(p.longest_streak, p.streak) AS cons,
           s.reached_at,
           RANK() OVER (ORDER BY s.points DESC, greatest(p.longest_streak, p.streak) DESC, s.reached_at ASC)::int AS rnk
    FROM s JOIN public.profiles p ON p.id = s.user_id
    WHERE s.points > 0
      AND (lower(coalesce(_scope,'global')) <> 'india' OR upper(coalesce(nullif(p.country,''),'IN')) = 'IN')
  )
  SELECT r.rnk, r.id, r.uname, r.avatar_url, r.cc, r.pts, r.cons,
         (SELECT coalesce(sum(c.amount),0) FROM public.coin_transactions c
           WHERE c.user_id = r.id AND c.amount > 0) >= 5000,
         r.id = auth.uid()
  FROM r
  WHERE r.rnk <= 100
  ORDER BY r.rnk
  LIMIT greatest(1, least(coalesce(_limit,100), 100))
  OFFSET greatest(0, coalesce(_offset,0));
$function$;

-- Backfill real names where the stored name was derived from the email
DO $$
BEGIN
  PERFORM set_config('app.economy_write', 'on', true);
  UPDATE public.profiles p
     SET display_name = coalesce(
           nullif(trim(u.raw_user_meta_data->>'full_name'), ''),
           nullif(trim(u.raw_user_meta_data->>'name'), ''),
           split_part(u.email, '@', 1)
         )
    FROM auth.users u
   WHERE u.id = p.id
     AND (
       p.display_name IS NULL
       OR trim(p.display_name) = ''
       OR p.display_name ILIKE '%@%'
       OR p.display_name = split_part(u.email, '@', 1)
     );
  UPDATE public.profiles SET username = split_part(username, '@', 1) WHERE username ILIKE '%@%';
END $$;

-- ==== 20260917132923_9c4b6450-807f-4553-9c0e-e46eee063530.sql ====
CREATE TABLE public.first_launch_assessments (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  baseline_score integer NOT NULL CHECK (baseline_score BETWEEN 0 AND 100),
  estimated_daily_lost_hours numeric(5,2) NOT NULL CHECK (estimated_daily_lost_hours >= 0),
  potential_daily_reclaim_hours numeric(5,2) NOT NULL CHECK (potential_daily_reclaim_hours >= 0),
  completed_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.first_launch_assessments TO authenticated;
GRANT ALL ON public.first_launch_assessments TO service_role;

ALTER TABLE public.first_launch_assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own first launch assessment"
ON public.first_launch_assessments
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own first launch assessment"
ON public.first_launch_assessments
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own first launch assessment"
ON public.first_launch_assessments
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_first_launch_assessments_updated_at
BEFORE UPDATE ON public.first_launch_assessments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- ==== 20260918023631_bdf5de59-5432-43c6-91f2-e5bd5912cff2.sql ====
CREATE TABLE IF NOT EXISTS public.coach_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id text,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  short_session_summary text,
  user_agreed_next_action text,
  next_check_in_at timestamptz,
  provider text NOT NULL DEFAULT 'gemini-live',
  model text,
  quality jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.coach_sessions TO authenticated;
GRANT ALL ON public.coach_sessions TO service_role;

ALTER TABLE public.coach_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "coach_sessions_select_own" ON public.coach_sessions;
CREATE POLICY "coach_sessions_select_own" ON public.coach_sessions
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "coach_sessions_insert_own" ON public.coach_sessions;
CREATE POLICY "coach_sessions_insert_own" ON public.coach_sessions
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "coach_sessions_update_own" ON public.coach_sessions;
CREATE POLICY "coach_sessions_update_own" ON public.coach_sessions
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS coach_sessions_user_started_idx
  ON public.coach_sessions (user_id, started_at DESC);

-- ==== 20260919162235_bfc2a331-a205-466d-925f-6781a6195d35.sql ====
CREATE OR REPLACE FUNCTION public.complete_focus_session(_tier text, _lock_mode text DEFAULT 'strict'::text, _blocked_apps text[] DEFAULT '{}'::text[])
 RETURNS TABLE(coins integer, awarded integer, minutes integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _pts integer;
  _mins integer;
  _last timestamptz;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  IF _tier = 'f49' THEN _pts := 15; _mins := 49;
  ELSIF _tier = 'f120' THEN _pts := 25; _mins := 120;
  ELSIF _tier = 'f229' THEN _pts := 40; _mins := 180;
  ELSE RAISE EXCEPTION 'invalid tier';
  END IF;

  -- anti-abuse: a session cannot be credited faster than its own duration
  SELECT max(fs.created_at) INTO _last FROM public.focus_sessions fs WHERE fs.user_id = _uid;
  IF _last IS NOT NULL AND _last > now() - (_mins || ' minutes')::interval THEN
    RAISE EXCEPTION 'focus session too soon';
  END IF;

  PERFORM set_config('app.economy_write', 'on', true);

  INSERT INTO public.focus_sessions(user_id, tier, minutes, coins_awarded, lock_mode, blocked_apps)
  VALUES (_uid, _tier, _mins, _pts, coalesce(_lock_mode, 'strict'), coalesce(_blocked_apps, '{}'));

  UPDATE public.profiles p SET coins = p.coins + _pts WHERE p.id = _uid;
  INSERT INTO public.coin_transactions(user_id, amount, reason) VALUES (_uid, _pts, 'focus');

  SELECT p.coins INTO coins FROM public.profiles p WHERE p.id = _uid;
  awarded := _pts;
  minutes := _mins;
  RETURN NEXT;
END; $function$;

CREATE OR REPLACE FUNCTION public.leave_pact(_pact_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _rows integer;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  UPDATE public.accountability_pacts p
     SET status = 'ended'
   WHERE p.id = _pact_id
     AND p.status = 'active'
     AND (p.owner_id = _uid OR p.partner_id = _uid);

  GET DIAGNOSTICS _rows = ROW_COUNT;
  RETURN _rows > 0;
END; $function$;

REVOKE ALL ON FUNCTION public.leave_pact(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.leave_pact(uuid) TO authenticated;

-- ==== 20260919164537_38f59b04-fc02-44f2-911d-e365e4412ad7.sql ====
CREATE OR REPLACE FUNCTION public.save_onboarding_step(_step integer, _answers jsonb)
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _name text;
  _age text;
  _minor boolean;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000';
  END IF;
  IF _step < 1 OR _step > 13 THEN
    RAISE EXCEPTION 'invalid onboarding step' USING ERRCODE = '22023';
  END IF;
  IF _answers IS NULL OR jsonb_typeof(_answers) <> 'object' THEN
    RAISE EXCEPTION 'invalid onboarding answers' USING ERRCODE = '22023';
  END IF;

  _name := nullif(left(trim(coalesce(_answers->>'preferred_name', '')), 60), '');
  IF _answers ? 'preferred_name' AND _name IS NULL THEN
    RAISE EXCEPTION 'name is required' USING ERRCODE = '22023';
  END IF;

  _age := nullif(trim(coalesce(_answers->>'age_range', '')), '');
  _minor := coalesce(_age IN ('under_13', '13_17'), false);

  INSERT INTO public.profiles (
    id, display_name, preferred_name, age_range, acquisition_source,
    primary_goal, first_habit, social_hours_daily, biggest_distraction,
    wake_time, sleep_time, consistency_days, routine_breaker,
    preferred_focus_time, commitment_milestone, onboarding_step,
    onboarding_version, safe_minor_mode, behavioral_tracking_allowed,
    updated_at
  ) VALUES (
    _uid,
    _name,
    _name,
    _age,
    left(nullif(trim(coalesce(_answers->>'acquisition_source', '')), ''), 40),
    left(nullif(trim(coalesce(_answers->>'primary_goal', '')), ''), 40),
    left(nullif(trim(coalesce(_answers->>'first_habit', '')), ''), 100),
    CASE WHEN _answers ? 'social_hours_daily' THEN LEAST(12, GREATEST(0, (_answers->>'social_hours_daily')::numeric)) ELSE NULL END,
    left(nullif(trim(coalesce(_answers->>'biggest_distraction', '')), ''), 40),
    CASE WHEN _answers ? 'wake_time' THEN nullif(_answers->>'wake_time', '')::time ELSE NULL END,
    CASE WHEN _answers ? 'sleep_time' THEN nullif(_answers->>'sleep_time', '')::time ELSE NULL END,
    CASE WHEN _answers ? 'consistency_days' THEN LEAST(7, GREATEST(0, (_answers->>'consistency_days')::integer)) ELSE NULL END,
    left(nullif(trim(coalesce(_answers->>'routine_breaker', '')), ''), 40),
    left(nullif(trim(coalesce(_answers->>'preferred_focus_time', '')), ''), 40),
    CASE WHEN _answers ? 'commitment_milestone' AND (_answers->>'commitment_milestone')::integer IN (21,60,90) THEN (_answers->>'commitment_milestone')::integer ELSE NULL END,
    _step,
    2,
    _minor,
    NOT _minor,
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    display_name = CASE WHEN _answers ? 'preferred_name' THEN _name ELSE profiles.display_name END,
    preferred_name = CASE WHEN _answers ? 'preferred_name' THEN _name ELSE profiles.preferred_name END,
    age_range = CASE WHEN _answers ? 'age_range' THEN _age ELSE profiles.age_range END,
    acquisition_source = CASE WHEN _answers ? 'acquisition_source' THEN left(nullif(trim(_answers->>'acquisition_source'), ''), 40) ELSE profiles.acquisition_source END,
    primary_goal = CASE WHEN _answers ? 'primary_goal' THEN left(nullif(trim(_answers->>'primary_goal'), ''), 40) ELSE profiles.primary_goal END,
    first_habit = CASE WHEN _answers ? 'first_habit' THEN left(nullif(trim(_answers->>'first_habit'), ''), 100) ELSE profiles.first_habit END,
    social_hours_daily = CASE WHEN _answers ? 'social_hours_daily' THEN LEAST(12, GREATEST(0, (_answers->>'social_hours_daily')::numeric)) ELSE profiles.social_hours_daily END,
    biggest_distraction = CASE WHEN _answers ? 'biggest_distraction' THEN left(nullif(trim(_answers->>'biggest_distraction'), ''), 40) ELSE profiles.biggest_distraction END,
    wake_time = CASE WHEN _answers ? 'wake_time' THEN nullif(_answers->>'wake_time', '')::time ELSE profiles.wake_time END,
    sleep_time = CASE WHEN _answers ? 'sleep_time' THEN nullif(_answers->>'sleep_time', '')::time ELSE profiles.sleep_time END,
    consistency_days = CASE WHEN _answers ? 'consistency_days' THEN LEAST(7, GREATEST(0, (_answers->>'consistency_days')::integer)) ELSE profiles.consistency_days END,
    routine_breaker = CASE WHEN _answers ? 'routine_breaker' THEN left(nullif(trim(_answers->>'routine_breaker'), ''), 40) ELSE profiles.routine_breaker END,
    preferred_focus_time = CASE WHEN _answers ? 'preferred_focus_time' THEN left(nullif(trim(_answers->>'preferred_focus_time'), ''), 40) ELSE profiles.preferred_focus_time END,
    commitment_milestone = CASE WHEN _answers ? 'commitment_milestone' AND (_answers->>'commitment_milestone')::integer IN (21,60,90) THEN (_answers->>'commitment_milestone')::integer ELSE profiles.commitment_milestone END,
    onboarding_step = GREATEST(profiles.onboarding_step, _step),
    onboarding_version = 2,
    safe_minor_mode = CASE WHEN _answers ? 'age_range' THEN _minor ELSE profiles.safe_minor_mode END,
    behavioral_tracking_allowed = CASE WHEN _answers ? 'age_range' THEN NOT _minor ELSE profiles.behavioral_tracking_allowed END,
    updated_at = now();
END;
$function$;

REVOKE ALL ON FUNCTION public.save_onboarding_step(integer, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_onboarding_step(integer, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_onboarding_step(integer, jsonb) TO service_role;

-- ==== 20260919170606_fc3ca859-75ad-48bf-a731-da905b1497ee.sql ====
CREATE OR REPLACE FUNCTION public.protect_verified_reward_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  _verified boolean := COALESCE(current_setting('app.economy_write', true), '') = 'on';
BEGIN
  IF _verified THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'daily_top_tasks' THEN
    IF TG_OP = 'INSERT' THEN
      NEW.done := false;
      NEW.coins_awarded := 0;
    ELSE
      NEW.done := OLD.done;
      NEW.coins_awarded := OLD.coins_awarded;
    END IF;
  ELSIF TG_OP = 'INSERT' THEN
    NEW.coins_awarded := 0;
  ELSE
    NEW.coins_awarded := OLD.coins_awarded;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_alarm_session_rewards ON public.alarm_sessions;
CREATE TRIGGER protect_alarm_session_rewards
BEFORE INSERT OR UPDATE ON public.alarm_sessions
FOR EACH ROW EXECUTE FUNCTION public.protect_verified_reward_fields();

DROP TRIGGER IF EXISTS protect_daily_top_task_rewards ON public.daily_top_tasks;
CREATE TRIGGER protect_daily_top_task_rewards
BEFORE INSERT OR UPDATE ON public.daily_top_tasks
FOR EACH ROW EXECUTE FUNCTION public.protect_verified_reward_fields();

DROP TRIGGER IF EXISTS protect_task_completion_rewards ON public.task_completions;
CREATE TRIGGER protect_task_completion_rewards
BEFORE INSERT OR UPDATE ON public.task_completions
FOR EACH ROW EXECUTE FUNCTION public.protect_verified_reward_fields();

DROP POLICY IF EXISTS alarm_sessions_insert_own ON public.alarm_sessions;
DROP POLICY IF EXISTS alarm_sessions_update_own ON public.alarm_sessions;
DROP POLICY IF EXISTS alarm_sessions_delete_own ON public.alarm_sessions;
REVOKE INSERT, UPDATE, DELETE ON public.alarm_sessions FROM authenticated;
GRANT SELECT ON public.alarm_sessions TO authenticated;
GRANT ALL ON public.alarm_sessions TO service_role;

DROP POLICY IF EXISTS task_completions_insert_own ON public.task_completions;
DROP POLICY IF EXISTS task_completions_update_own ON public.task_completions;
DROP POLICY IF EXISTS task_completions_delete_own ON public.task_completions;
REVOKE INSERT, UPDATE, DELETE ON public.task_completions FROM authenticated;
GRANT SELECT ON public.task_completions TO authenticated;
GRANT ALL ON public.task_completions TO service_role;

DROP POLICY IF EXISTS daily_top_tasks_own ON public.daily_top_tasks;
CREATE POLICY daily_top_tasks_select_own ON public.daily_top_tasks
FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY daily_top_tasks_insert_own ON public.daily_top_tasks
FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND done = false AND coins_awarded = 0);
CREATE POLICY daily_top_tasks_update_own ON public.daily_top_tasks
FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
REVOKE DELETE ON public.daily_top_tasks FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON public.daily_top_tasks TO authenticated;
GRANT ALL ON public.daily_top_tasks TO service_role;

REVOKE ALL ON FUNCTION public.protect_verified_reward_fields() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.protect_verified_reward_fields() TO authenticated, service_role;

-- ==== 20260919173826_9279883b-9d3b-436c-9107-c84e6c2b4e43.sql ====
alter table public.goals
  add column if not exists category text,
  add column if not exists started_on date not null default current_date,
  add column if not exists target_coins integer not null default 0,
  add column if not exists earned_coins integer not null default 0,
  add column if not exists celebrated boolean not null default false,
  add column if not exists completed_at timestamptz;

create table if not exists public.goal_habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid not null references public.goals(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (goal_id, task_id)
);

create index if not exists goal_habits_user_idx on public.goal_habits(user_id);
create index if not exists goal_habits_task_idx on public.goal_habits(task_id);
create index if not exists goal_habits_goal_idx on public.goal_habits(goal_id);

grant select, insert, delete on public.goal_habits to authenticated;
grant all on public.goal_habits to service_role;
alter table public.goal_habits enable row level security;

drop policy if exists goal_habits_select_own on public.goal_habits;
drop policy if exists goal_habits_insert_own on public.goal_habits;
drop policy if exists goal_habits_delete_own on public.goal_habits;
create policy goal_habits_select_own on public.goal_habits for select to authenticated using (auth.uid() = user_id);
create policy goal_habits_insert_own on public.goal_habits for insert to authenticated with check (auth.uid() = user_id);
create policy goal_habits_delete_own on public.goal_habits for delete to authenticated using (auth.uid() = user_id);

create or replace function public.goal_scheduled_count(_frequency text, _from date, _to date)
returns integer language sql immutable set search_path = public as $$
  select case
    when _from is null or _to is null or _to < _from then 0
    when coalesce(_frequency, 'daily') = 'weekly' then ((_to - _from) / 7) + 1
    when _frequency = 'weekdays' then (select count(*) from generate_series(_from, _to, interval '1 day') d where extract(isodow from d) between 1 and 5)::int
    when _frequency = 'weekends' then (select count(*) from generate_series(_from, _to, interval '1 day') d where extract(isodow from d) >= 6)::int
    else (_to - _from) + 1
  end;
$$;

create or replace function public.recalc_goal(_goal_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  g public.goals%rowtype;
  _end date;
  _target integer := 0;
  _earned integer := 0;
  _pct integer;
begin
  select * into g from public.goals where id = _goal_id;
  if not found then return; end if;
  _end := coalesce(g.target_date, g.started_on + 20);

  select coalesce(sum(least(greatest(t.pts, 0), 50) * public.goal_scheduled_count(t.frequency, greatest(g.started_on, coalesce(t.started_on, g.started_on)), _end)), 0)
    into _target
    from public.goal_habits gh join public.tasks t on t.id = gh.task_id
   where gh.goal_id = g.id;

  select coalesce(sum(tc.coins_awarded), 0) into _earned
    from public.task_completions tc
   where tc.user_id = g.user_id
     and tc.task_id in (select task_id from public.goal_habits where goal_id = g.id)
     and tc.completed_on between g.started_on and _end;

  if _target > 0 then
    _pct := least(100, floor(_earned::numeric * 100 / _target)::int);
  else
    _pct := g.progress;
  end if;

  update public.goals
     set target_coins = _target,
         earned_coins = _earned,
         progress = greatest(case when _target > 0 then _pct else progress end, 0),
         completed = case when _target > 0 and _pct >= 100 then true else completed end,
         completed_at = case when _target > 0 and _pct >= 100 and completed_at is null then now() else completed_at end,
         updated_at = now()
   where id = g.id;
end $$;

revoke all on function public.recalc_goal(uuid) from public, anon;
grant execute on function public.recalc_goal(uuid) to authenticated, service_role;

create or replace function public.sync_goals_from_completion()
returns trigger language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in select distinct gh.goal_id from public.goal_habits gh where gh.task_id = coalesce(NEW.task_id, OLD.task_id) loop
    perform public.recalc_goal(r.goal_id);
  end loop;
  return null;
end $$;

drop trigger if exists trg_sync_goals_from_completion on public.task_completions;
create trigger trg_sync_goals_from_completion
after insert or update or delete on public.task_completions
for each row execute function public.sync_goals_from_completion();

create or replace function public.save_goal(_goal_id uuid, _title text, _category text, _target_date date, _task_ids uuid[])
returns uuid language plpgsql security definer set search_path = public as $$
declare
  _uid uuid := auth.uid();
  _id uuid;
  _t text := trim(coalesce(_title, ''));
  _cat text := nullif(left(trim(coalesce(_category, '')), 40), '');
begin
  if _uid is null then raise exception 'not authenticated'; end if;
  if length(_t) < 1 or length(_t) > 120 then raise exception 'goal title must be between 1 and 120 characters'; end if;
  if _target_date is not null and _target_date < current_date then raise exception 'target date must be today or later'; end if;

  if _goal_id is null then
    insert into public.goals(user_id, title, category, target_date, started_on)
    values (_uid, _t, _cat, _target_date, current_date)
    returning id into _id;
  else
    update public.goals set title = _t, category = _cat, target_date = _target_date, updated_at = now()
     where id = _goal_id and user_id = _uid
    returning id into _id;
    if _id is null then raise exception 'goal not found'; end if;
  end if;

  delete from public.goal_habits
   where goal_id = _id and user_id = _uid
     and not (task_id = any (coalesce(_task_ids, '{}'::uuid[])));

  insert into public.goal_habits(user_id, goal_id, task_id)
  select _uid, _id, t.id from public.tasks t
   where t.user_id = _uid and t.id = any (coalesce(_task_ids, '{}'::uuid[]))
  on conflict (goal_id, task_id) do nothing;

  perform public.recalc_goal(_id);
  return _id;
end $$;

revoke all on function public.save_goal(uuid, text, text, date, uuid[]) from public, anon;
grant execute on function public.save_goal(uuid, text, text, date, uuid[]) to authenticated, service_role;

create or replace function public.mark_goal_celebrated(_goal_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.goals set celebrated = true where id = _goal_id and user_id = auth.uid();
$$;

revoke all on function public.mark_goal_celebrated(uuid) from public, anon;
grant execute on function public.mark_goal_celebrated(uuid) to authenticated, service_role;

create or replace function public.goal_overview()
returns jsonb language plpgsql security definer stable set search_path = public as $$
declare
  _uid uuid := auth.uid();
  _streak integer := 0;
  _res jsonb;
begin
  if _uid is null then raise exception 'not authenticated'; end if;
  select coalesce(streak, 0) into _streak from public.profiles where id = _uid;

  with g as (select * from public.goals where user_id = _uid),
  bounds as (select g.id, least(current_date, coalesce(g.target_date, current_date)) as upto, greatest(1, (least(current_date, coalesce(g.target_date, current_date)) - g.started_on) + 1) as days from g),
  links as (
    select gh.goal_id, gh.task_id, t.name, t.icon, t.pts, t.frequency
      from public.goal_habits gh join public.tasks t on t.id = gh.task_id
     where gh.user_id = _uid
  ),
  expected as (
    select g.id,
      coalesce(sum(public.goal_scheduled_count(l.frequency, g.started_on, b.upto)), 0) as exp_all,
      coalesce(sum(public.goal_scheduled_count(l.frequency, greatest(g.started_on, current_date - 6), b.upto)), 0) as exp_7
      from g join bounds b on b.id = g.id left join links l on l.goal_id = g.id
     group by g.id
  ),
  done as (
    select g.id,
      count(tc.id) as done_all,
      count(distinct tc.completed_on) as active_days,
      count(tc.id) filter (where tc.completed_on >= current_date - 6) as done_7
      from g join bounds b on b.id = g.id
      left join links l on l.goal_id = g.id
      left join public.task_completions tc
        on tc.user_id = _uid and tc.task_id = l.task_id and tc.completed_on between g.started_on and b.upto
     group by g.id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', g.id,
    'title', g.title,
    'category', g.category,
    'target_date', g.target_date,
    'started_on', g.started_on,
    'progress', g.progress,
    'completed', g.completed,
    'celebrated', g.celebrated,
    'target_coins', g.target_coins,
    'earned_coins', g.earned_coins,
    'habits', (select coalesce(jsonb_agg(jsonb_build_object('id', l.task_id, 'name', l.name, 'icon', l.icon, 'pts', l.pts) order by l.name), '[]'::jsonb) from links l where l.goal_id = g.id),
    'readiness', round(
        50 * (case when e.exp_all > 0 then least(1, d.done_all::numeric / e.exp_all) else 0 end)
      + 20 * least(1, _streak::numeric / 21)
      + 20 * least(1, d.active_days::numeric / b.days)
      + 10 * (case when e.exp_7 > 0 then least(1, d.done_7::numeric / e.exp_7) else 0 end)
    )::int
  ) order by g.created_at desc), '[]'::jsonb)
  into _res
  from g join bounds b on b.id = g.id join expected e on e.id = g.id join done d on d.id = g.id;

  return _res;
end $$;

revoke all on function public.goal_overview() from public, anon;
grant execute on function public.goal_overview() to authenticated, service_role;

-- ==== 20260919173854_6c4718a3-5e93-4f80-b49d-9e7e43644652.sql ====
revoke all on function public.sync_goals_from_completion() from public, anon, authenticated;

-- ==== 20260921004953_90f9a851-c9ba-4b20-b5f6-95679cbe2a45.sql ====
UPDATE public.tasks
SET pts = 10
WHERE lower(trim(name)) IN ('workout', 'gym', 'workout/gym');

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
    COALESCE(
      nullif(trim(NEW.raw_user_meta_data->>'display_name'), ''),
      nullif(trim(NEW.raw_user_meta_data->>'full_name'), ''),
      nullif(trim(NEW.raw_user_meta_data->>'name'), ''),
      split_part(NEW.email, '@', 1)
    ),
    now() + interval '3 days',
    false
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.tasks (user_id, icon, name, pts, sort_order) VALUES
    (NEW.id, '🌅', 'Wake Up 4AM', 21, 1),
    (NEW.id, '🚿', 'Cold Shower', 10, 2),
    (NEW.id, '💪', 'Workout', 10, 3),
    (NEW.id, '📚', 'Deep Focus', 8, 4),
    (NEW.id, '🎯', 'Top 3 Missions', 20, 5);

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.complete_zen_session(_minutes integer)
RETURNS TABLE(coins integer, awarded integer, minutes integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _mins integer := LEAST(GREATEST(coalesce(_minutes, 0), 0), 60);
  _pts integer := 5;
  _last timestamptz;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _mins < 5 THEN RAISE EXCEPTION 'session too short'; END IF;

  SELECT max(fs.created_at) INTO _last FROM public.focus_sessions fs
    WHERE fs.user_id = _uid AND fs.tier = 'zen';
  IF _last IS NOT NULL AND _last > now() - (_mins || ' minutes')::interval THEN
    RAISE EXCEPTION 'zen session too soon';
  END IF;

  PERFORM set_config('app.economy_write', 'on', true);

  INSERT INTO public.focus_sessions(user_id, tier, minutes, coins_awarded, lock_mode, blocked_apps)
  VALUES (_uid, 'zen', _mins, _pts, 'flex', '{}');

  UPDATE public.profiles p SET coins = p.coins + _pts WHERE p.id = _uid;
  INSERT INTO public.coin_transactions(user_id, amount, reason) VALUES (_uid, _pts, 'zen');

  SELECT p.coins INTO coins FROM public.profiles p WHERE p.id = _uid;
  awarded := _pts;
  minutes := _mins;
  RETURN NEXT;
END;
$function$;

CREATE OR REPLACE FUNCTION public.complete_focus_session(_tier text, _lock_mode text DEFAULT 'strict'::text, _blocked_apps text[] DEFAULT '{}'::text[])
RETURNS TABLE(coins integer, awarded integer, minutes integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _pts integer;
  _mins integer;
  _last timestamptz;
  _paid boolean;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.subscriptions s
    WHERE s.user_id = _uid
      AND (
        (s.status IN ('active', 'trialing', 'past_due') AND (s.current_period_end IS NULL OR s.current_period_end > now()))
        OR (s.status = 'canceled' AND s.current_period_end > now())
      )
  ) INTO _paid;
  IF NOT _paid THEN RAISE EXCEPTION 'AXEN Pro subscription required'; END IF;

  IF _tier = 'f49' THEN _pts := 5; _mins := 49;
  ELSIF _tier = 'f120' THEN _pts := 10; _mins := 120;
  ELSIF _tier = 'f229' THEN _pts := 15; _mins := 180;
  ELSE RAISE EXCEPTION 'invalid tier';
  END IF;

  SELECT max(fs.created_at) INTO _last
  FROM public.focus_sessions fs
  WHERE fs.user_id = _uid;
  IF _last IS NOT NULL AND _last > now() - (_mins || ' minutes')::interval THEN
    RAISE EXCEPTION 'focus session too soon';
  END IF;

  PERFORM set_config('app.economy_write', 'on', true);

  INSERT INTO public.focus_sessions(user_id, tier, minutes, coins_awarded, lock_mode, blocked_apps)
  VALUES (_uid, _tier, _mins, _pts, coalesce(_lock_mode, 'strict'), coalesce(_blocked_apps, '{}'));

  UPDATE public.profiles p SET coins = p.coins + _pts WHERE p.id = _uid;
  INSERT INTO public.coin_transactions(user_id, amount, reason) VALUES (_uid, _pts, 'focus');

  SELECT p.coins INTO coins FROM public.profiles p WHERE p.id = _uid;
  awarded := _pts;
  minutes := _mins;
  RETURN NEXT;
END;
$function$;

REVOKE ALL ON FUNCTION public.complete_zen_session(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_zen_session(integer) TO authenticated;
GRANT ALL ON FUNCTION public.complete_zen_session(integer) TO service_role;
REVOKE ALL ON FUNCTION public.complete_focus_session(text, text, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_focus_session(text, text, text[]) TO authenticated;
GRANT ALL ON FUNCTION public.complete_focus_session(text, text, text[]) TO service_role;

-- ==== 20260921013902_3d7f1098-9973-4729-a79e-1236f27b10dc.sql ====
CREATE OR REPLACE FUNCTION public.protect_verified_reward_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  _verified boolean := COALESCE(current_setting('app.economy_write', true), '') = 'on';
BEGIN
  IF _verified THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'daily_top_tasks' THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.done IS DISTINCT FROM false OR NEW.coins_awarded IS DISTINCT FROM 0 THEN
        RAISE EXCEPTION 'reward fields can only be set by the server';
      END IF;
    ELSE
      IF NEW.done IS DISTINCT FROM OLD.done OR NEW.coins_awarded IS DISTINCT FROM OLD.coins_awarded THEN
        RAISE EXCEPTION 'reward fields can only be changed by the server';
      END IF;
    END IF;
  ELSE
    IF TG_OP = 'INSERT' THEN
      IF NEW.coins_awarded IS DISTINCT FROM 0 THEN
        RAISE EXCEPTION 'reward fields can only be set by the server';
      END IF;
    ELSE
      IF NEW.coins_awarded IS DISTINCT FROM OLD.coins_awarded THEN
        RAISE EXCEPTION 'reward fields can only be changed by the server';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.protect_verified_reward_fields() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.protect_verified_reward_fields() TO authenticated, service_role;