-- a) Coach registry: server-only writes
DROP POLICY IF EXISTS "own coach mat insert" ON public.coach_plan_materialized;
DROP POLICY IF EXISTS "own coach mat update" ON public.coach_plan_materialized;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.coach_plan_materialized FROM authenticated, anon;

-- b) Reversible archive columns
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS archived_reason text;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS archived_prev_active boolean;

DROP TRIGGER IF EXISTS enforce_task_limit_trg ON public.tasks;

UPDATE public.tasks t SET archived_prev_active = t.is_active, is_active = false,
  archived_at = now(), archived_reason = 'coach_legacy'
WHERE t.is_active AND t.archived_at IS NULL
  AND t.id IN (SELECT task_id FROM public.coach_plan_materialized WHERE task_id IS NOT NULL);

-- c) Keep 5 personal tasks per user (latest completion, then newest); built-in defaults (first of each name) kept
WITH act AS (
  SELECT t.id, t.user_id, t.name, t.created_at,
         row_number() OVER (PARTITION BY t.user_id, t.name ORDER BY t.created_at, t.id) dn
  FROM public.tasks t WHERE t.is_active AND t.archived_at IS NULL
), pers AS (
  SELECT a.*, (SELECT max(c.created_at) FROM public.task_completions c WHERE c.task_id = a.id) lastc
  FROM act a
  WHERE NOT (a.name IN ('Wake Up 4AM','Cold Shower','Workout','Deep Focus','Top 3 Missions') AND a.dn = 1)
), rk AS (
  SELECT id, row_number() OVER (PARTITION BY user_id ORDER BY lastc DESC NULLS LAST, created_at DESC, id DESC) r FROM pers
)
UPDATE public.tasks t SET archived_prev_active = t.is_active, is_active = false,
  archived_at = now(), archived_reason = 'over_limit'
FROM rk WHERE rk.id = t.id AND rk.r > 5;

-- d) 5 personal Home tasks, locked per user
CREATE OR REPLACE FUNCTION public.enforce_task_limit()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _defaults text[] := ARRAY['Wake Up 4AM','Cold Shower','Workout','Deep Focus','Top 3 Missions'];
  _count int;
BEGIN
  IF NOT (NEW.is_active AND NEW.archived_at IS NULL) THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.is_active THEN RETURN NEW; END IF;
  PERFORM pg_advisory_xact_lock(hashtext(NEW.user_id::text));
  IF NEW.name = ANY(_defaults) AND NOT EXISTS (
       SELECT 1 FROM public.tasks t WHERE t.user_id = NEW.user_id AND t.id <> NEW.id
         AND t.is_active AND t.archived_at IS NULL AND t.name = NEW.name) THEN
    RETURN NEW;
  END IF;
  SELECT count(*) - count(DISTINCT t.name) FILTER (WHERE t.name = ANY(_defaults))
    INTO _count
  FROM public.tasks t
  WHERE t.user_id = NEW.user_id AND t.id <> NEW.id AND t.is_active AND t.archived_at IS NULL
    AND NOT EXISTS (SELECT 1 FROM public.coach_plan_materialized m WHERE m.task_id = t.id);
  IF _count >= 5 THEN
    RAISE EXCEPTION 'Home task limit reached (5). Archive or delete a task to add a new one.';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER enforce_task_limit_trg BEFORE INSERT OR UPDATE OF is_active, archived_at ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.enforce_task_limit();

-- e) complete_task rejects Coach and archived tasks before any write
CREATE OR REPLACE FUNCTION public.complete_task(_task_id uuid)
 RETURNS TABLE(coins integer, streak integer, longest_streak integer, awarded integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid(); _pts integer; _name text;
  _today date := (now() AT TIME ZONE 'utc')::date;
  _last date; _new_streak integer; _inserted boolean := false;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF EXISTS (SELECT 1 FROM public.coach_plan_materialized m WHERE m.task_id = _task_id) THEN
    RAISE EXCEPTION 'Coach plan tasks are tracked in My Plan and do not earn rewards';
  END IF;
  IF EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = _task_id AND t.archived_at IS NOT NULL) THEN
    RAISE EXCEPTION 'task is archived';
  END IF;
  SELECT t.pts, t.name INTO _pts, _name FROM public.tasks t WHERE t.id = _task_id AND t.user_id = _uid AND t.is_active;
  IF _name IS NULL THEN RAISE EXCEPTION 'task not found'; END IF;
  IF _name ~* 'wake' THEN RAISE EXCEPTION 'Wake Up requires the server-issued alarm challenge'; END IF;
  _pts := CASE WHEN public.axen_is_priority_habit(_name) THEN 3 ELSE LEAST(GREATEST(coalesce(_pts,2),1),5) END;
  _pts := LEAST(_pts, public.axen_daily_coin_room(_uid));
  PERFORM set_config('app.economy_write', 'on', true);

  INSERT INTO public.task_completions(user_id, task_id, completed_on, coins_awarded)
  VALUES (_uid, _task_id, _today, _pts)
  ON CONFLICT (user_id, task_id, completed_on) DO NOTHING;
  GET DIAGNOSTICS _inserted = ROW_COUNT;
  IF NOT _inserted THEN
    SELECT p.coins, p.streak, p.longest_streak INTO coins, streak, longest_streak FROM public.profiles p WHERE p.id = _uid;
    awarded := 0; RETURN NEXT; RETURN;
  END IF;

  SELECT p.last_activity_date INTO _last FROM public.profiles p WHERE p.id = _uid;
  IF _last = _today THEN SELECT p.streak INTO _new_streak FROM public.profiles p WHERE p.id = _uid;
  ELSIF _last = _today - 1 THEN SELECT p.streak + 1 INTO _new_streak FROM public.profiles p WHERE p.id = _uid;
  ELSE _new_streak := 1; END IF;

  UPDATE public.profiles p SET coins = p.coins + _pts, streak = _new_streak,
    longest_streak = GREATEST(p.longest_streak, _new_streak), last_activity_date = _today WHERE p.id = _uid;
  IF _pts > 0 THEN
    INSERT INTO public.coin_transactions(user_id, amount, reason, ref_id) VALUES (_uid, _pts, 'task', _task_id);
  END IF;
  SELECT p.coins, p.streak, p.longest_streak INTO coins, streak, longest_streak FROM public.profiles p WHERE p.id = _uid;
  awarded := _pts; RETURN NEXT;
END; $function$;

-- e) same check in the task_completions guard, INSERT only, for every path
CREATE OR REPLACE FUNCTION public.protect_verified_reward_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  _verified boolean := COALESCE(current_setting('app.economy_write', true), '') = 'on';
BEGIN
  IF TG_TABLE_NAME = 'task_completions' AND TG_OP = 'INSERT' THEN
    IF EXISTS (SELECT 1 FROM public.coach_plan_materialized m WHERE m.task_id = NEW.task_id) THEN
      RAISE EXCEPTION 'Coach plan tasks cannot be completed for rewards';
    END IF;
    IF EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = NEW.task_id AND t.archived_at IS NOT NULL) THEN
      RAISE EXCEPTION 'archived tasks cannot be completed';
    END IF;
  END IF;

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
$function$;