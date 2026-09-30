CREATE INDEX IF NOT EXISTS task_completions_user_completed_on_idx
ON public.task_completions (user_id, completed_on);