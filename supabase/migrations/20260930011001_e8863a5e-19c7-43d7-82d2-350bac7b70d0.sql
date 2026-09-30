CREATE UNIQUE INDEX IF NOT EXISTS accountability_one_checkin_per_day_idx
ON public.accountability_events (connection_id, actor_id, ((created_at AT TIME ZONE 'UTC')::date))
WHERE kind = 'checkin';