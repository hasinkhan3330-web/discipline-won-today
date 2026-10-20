-- Defense in depth for the wake alarm: browsers reach these tables only through
-- SECURITY DEFINER functions, so signed-in and anonymous roles need no direct table rights.
-- RLS stays enabled as the second barrier; service_role keeps access for the private processor.
REVOKE ALL ON TABLE public.alarm_events FROM anon, authenticated;
REVOKE ALL ON TABLE public.wake_question_history FROM anon, authenticated;
REVOKE ALL ON TABLE public.quiz_questions FROM anon, authenticated;
GRANT ALL ON TABLE public.alarm_events, public.wake_question_history, public.quiz_questions TO service_role;