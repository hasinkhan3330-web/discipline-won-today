REVOKE EXECUTE ON FUNCTION public.leaderboard_top(text, text, integer, integer) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.my_leaderboard_position(text, text) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.leaderboard_top(text, text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_leaderboard_position(text, text) TO authenticated;

DROP POLICY IF EXISTS "avatars read all authenticated" ON storage.objects;

DROP POLICY IF EXISTS "coach_messages_no_update" ON public.coach_messages;
CREATE POLICY "coach_messages_no_update" ON public.coach_messages
  FOR UPDATE TO authenticated USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS "coach_messages_no_delete" ON public.coach_messages;
CREATE POLICY "coach_messages_no_delete" ON public.coach_messages
  FOR DELETE TO authenticated USING (false);