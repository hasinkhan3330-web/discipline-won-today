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