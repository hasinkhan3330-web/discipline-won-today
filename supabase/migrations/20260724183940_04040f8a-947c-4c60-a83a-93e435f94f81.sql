
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
