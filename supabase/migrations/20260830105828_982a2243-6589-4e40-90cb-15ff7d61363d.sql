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