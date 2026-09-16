
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
