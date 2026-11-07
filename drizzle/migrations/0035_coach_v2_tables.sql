CREATE TABLE public.coach_profile (
  user_id uuid PRIMARY KEY,
  slots jsonb NOT NULL DEFAULT '{}'::jsonb,
  onboarding_done boolean NOT NULL DEFAULT false,
  coach_style text,
  age_range text,
  timezone text NOT NULL DEFAULT 'UTC',
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.coach_profile TO authenticated;
GRANT ALL ON public.coach_profile TO service_role;
ALTER TABLE public.coach_profile ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own coach profile select" ON public.coach_profile FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own coach profile insert" ON public.coach_profile FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own coach profile update" ON public.coach_profile FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.coach_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','confirmed','archived')),
  days integer NOT NULL CHECK (days IN (1,7,21)),
  goal text,
  plan jsonb NOT NULL DEFAULT '{}'::jsonb,
  start_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX coach_plans_user_status_idx ON public.coach_plans(user_id, status);
CREATE UNIQUE INDEX coach_plans_one_confirmed ON public.coach_plans(user_id) WHERE status = 'confirmed';
GRANT SELECT, INSERT, UPDATE ON public.coach_plans TO authenticated;
GRANT ALL ON public.coach_plans TO service_role;
ALTER TABLE public.coach_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own coach plans select" ON public.coach_plans FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own coach plans insert" ON public.coach_plans FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own coach plans update" ON public.coach_plans FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.coach_plan_materialized (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  plan_id uuid NOT NULL REFERENCES public.coach_plans(id) ON DELETE CASCADE,
  day_index integer NOT NULL,
  task_index integer NOT NULL,
  local_day date NOT NULL,
  task_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plan_id, day_index, task_index)
);
GRANT SELECT, INSERT, UPDATE ON public.coach_plan_materialized TO authenticated;
GRANT ALL ON public.coach_plan_materialized TO service_role;
ALTER TABLE public.coach_plan_materialized ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own coach mat select" ON public.coach_plan_materialized FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own coach mat insert" ON public.coach_plan_materialized FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own coach mat update" ON public.coach_plan_materialized FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.coach_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL CHECK (type IN ('win','failure_pattern','preference','weekly_review')),
  note text NOT NULL CHECK (char_length(note) BETWEEN 1 AND 500),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX coach_memory_user_idx ON public.coach_memory(user_id, created_at DESC);
GRANT SELECT, INSERT ON public.coach_memory TO authenticated;
GRANT ALL ON public.coach_memory TO service_role;
ALTER TABLE public.coach_memory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own coach memory select" ON public.coach_memory FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own coach memory insert" ON public.coach_memory FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);