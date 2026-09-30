CREATE OR REPLACE FUNCTION public.get_accountability_details()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  WITH active_connection AS (
    SELECT a.*,
           CASE WHEN a.user_id = auth.uid() THEN a.partner_id ELSE a.user_id END AS other_id
    FROM public.accountability_connections a
    WHERE a.status = 'active'
      AND (a.user_id = auth.uid() OR a.partner_id = auth.uid())
    LIMIT 1
  )
  SELECT jsonb_build_object(
    'my_commitment', CASE WHEN a.user_id = auth.uid() THEN a.commitment_by_user ELSE a.commitment_by_partner END,
    'partner_commitment', CASE WHEN a.user_id = auth.uid() THEN a.commitment_by_partner ELSE a.commitment_by_user END,
    'partner_streak', coalesce(p.streak, 0),
    'partner_weekly_coins', coalesce((SELECT sum(ct.amount)::bigint FROM public.coin_transactions ct
      WHERE ct.user_id = a.other_id AND ct.amount > 0
        AND ct.created_at >= date_trunc('week', now())
        AND ct.created_at < date_trunc('week', now()) + interval '7 days'), 0),
    'partner_weekly_tasks', coalesce((SELECT count(*)::integer FROM public.task_completions tc
      WHERE tc.user_id = a.other_id
        AND tc.completed_on >= date_trunc('week', current_date)::date
        AND tc.completed_on < (date_trunc('week', current_date) + interval '7 days')::date), 0),
    'can_check_in', (EXISTS (SELECT 1 FROM public.task_completions mine
      WHERE mine.user_id = auth.uid() AND mine.completed_on = current_date)
      OR EXISTS (SELECT 1 FROM public.daily_top_tasks top_task
      WHERE top_task.user_id = auth.uid() AND top_task.day = current_date AND top_task.done)),
    'checked_in_today', EXISTS (SELECT 1 FROM public.accountability_events ev
      WHERE ev.connection_id = a.id AND ev.actor_id = auth.uid() AND ev.kind = 'checkin'
        AND ev.created_at >= current_date::timestamptz
        AND ev.created_at < (current_date + 1)::timestamptz)
  )
  FROM active_connection a
  LEFT JOIN public.profiles p ON p.id = a.other_id;
$$;

REVOKE ALL ON FUNCTION public.get_accountability_details() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_accountability_details() TO authenticated;