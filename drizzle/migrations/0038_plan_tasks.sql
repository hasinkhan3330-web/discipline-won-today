CREATE TABLE public.plan_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  plan_title text,
  task_date date NOT NULL,
  day_number int,
  title text NOT NULL,
  description text,
  duration_minutes int,
  completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plan_tasks TO authenticated;
GRANT ALL ON public.plan_tasks TO service_role;
ALTER TABLE public.plan_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own plan tasks select" ON public.plan_tasks FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own plan tasks insert" ON public.plan_tasks FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own plan tasks update" ON public.plan_tasks FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own plan tasks delete" ON public.plan_tasks FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE INDEX plan_tasks_user_date_idx ON public.plan_tasks (user_id, task_date);
ALTER PUBLICATION supabase_realtime ADD TABLE public.plan_tasks;

-- Atomic replace: runs as the caller (RLS applies); user comes only from auth.uid().
CREATE OR REPLACE FUNCTION public.save_plan_tasks(_plan_title text, _tasks jsonb)
RETURNS int
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _n int;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not signed in'; END IF;
  IF jsonb_typeof(_tasks) <> 'array' OR jsonb_array_length(_tasks) = 0 THEN RAISE EXCEPTION 'no tasks'; END IF;
  DELETE FROM public.plan_tasks
   WHERE user_id = _uid AND completed = false
     AND task_date IN (SELECT DISTINCT (t->>'task_date')::date FROM jsonb_array_elements(_tasks) t);
  INSERT INTO public.plan_tasks (user_id, plan_title, task_date, day_number, title, description, duration_minutes)
  SELECT _uid, left(_plan_title, 120), (t->>'task_date')::date, NULLIF(t->>'day_number','')::int,
         left(t->>'title', 160), left(t->>'description', 500), NULLIF(t->>'duration_minutes','')::int
    FROM jsonb_array_elements(_tasks) t;
  GET DIAGNOSTICS _n = ROW_COUNT;
  RETURN _n;
END $$;
REVOKE ALL ON FUNCTION public.save_plan_tasks(text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_plan_tasks(text, jsonb) TO authenticated;