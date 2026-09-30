CREATE OR REPLACE FUNCTION public.axen_user_local_day(_uid uuid)
RETURNS date
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT (now() AT TIME ZONE coalesce(
    (SELECT d.timezone FROM public.daily_contracts d
      WHERE d.user_id = _uid ORDER BY d.created_at DESC LIMIT 1),
    (SELECT r.timezone FROM public.habit_reminders r
      WHERE r.user_id = _uid ORDER BY r.created_at DESC LIMIT 1),
    'UTC'
  ))::date;
$$;

REVOKE ALL ON FUNCTION public.axen_user_local_day(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.axen_user_local_day(uuid) TO service_role;

DROP INDEX IF EXISTS public.accountability_one_checkin_per_day_idx;
CREATE UNIQUE INDEX IF NOT EXISTS accountability_one_checkin_per_utc_day_idx
ON public.accountability_events (connection_id, actor_id, ((created_at AT TIME ZONE 'UTC')::date))
WHERE kind = 'checkin';