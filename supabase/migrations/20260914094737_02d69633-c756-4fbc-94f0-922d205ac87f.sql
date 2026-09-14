ALTER FUNCTION public.save_onboarding_step(integer,jsonb) SECURITY INVOKER;
ALTER FUNCTION public.activate_axen_plan(jsonb) SECURITY INVOKER;
REVOKE ALL ON FUNCTION public.enforce_reminder_limit() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.touch_coach_conversation() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_focus_music_session(uuid,integer,text) FROM public, anon;
REVOKE ALL ON FUNCTION public.complete_wake_protocol(text,uuid) FROM public, anon;