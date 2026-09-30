CREATE INDEX IF NOT EXISTS accountability_events_connection_actor_kind_time_idx
ON public.accountability_events (connection_id, actor_id, kind, created_at DESC);