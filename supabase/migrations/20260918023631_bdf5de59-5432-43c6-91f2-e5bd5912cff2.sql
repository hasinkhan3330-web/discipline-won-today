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