CREATE OR REPLACE FUNCTION public.protect_verified_reward_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  _verified boolean := COALESCE(current_setting('app.economy_write', true), '') = 'on';
BEGIN
  IF _verified THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'daily_top_tasks' THEN
    IF TG_OP = 'INSERT' THEN
      NEW.done := false;
      NEW.coins_awarded := 0;
    ELSE
      NEW.done := OLD.done;
      NEW.coins_awarded := OLD.coins_awarded;
    END IF;
  ELSIF TG_OP = 'INSERT' THEN
    NEW.coins_awarded := 0;
  ELSE
    NEW.coins_awarded := OLD.coins_awarded;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_alarm_session_rewards ON public.alarm_sessions;
CREATE TRIGGER protect_alarm_session_rewards
BEFORE INSERT OR UPDATE ON public.alarm_sessions
FOR EACH ROW EXECUTE FUNCTION public.protect_verified_reward_fields();

DROP TRIGGER IF EXISTS protect_daily_top_task_rewards ON public.daily_top_tasks;
CREATE TRIGGER protect_daily_top_task_rewards
BEFORE INSERT OR UPDATE ON public.daily_top_tasks
FOR EACH ROW EXECUTE FUNCTION public.protect_verified_reward_fields();

DROP TRIGGER IF EXISTS protect_task_completion_rewards ON public.task_completions;
CREATE TRIGGER protect_task_completion_rewards
BEFORE INSERT OR UPDATE ON public.task_completions
FOR EACH ROW EXECUTE FUNCTION public.protect_verified_reward_fields();

DROP POLICY IF EXISTS alarm_sessions_insert_own ON public.alarm_sessions;
DROP POLICY IF EXISTS alarm_sessions_update_own ON public.alarm_sessions;
DROP POLICY IF EXISTS alarm_sessions_delete_own ON public.alarm_sessions;
REVOKE INSERT, UPDATE, DELETE ON public.alarm_sessions FROM authenticated;
GRANT SELECT ON public.alarm_sessions TO authenticated;
GRANT ALL ON public.alarm_sessions TO service_role;

DROP POLICY IF EXISTS task_completions_insert_own ON public.task_completions;
DROP POLICY IF EXISTS task_completions_update_own ON public.task_completions;
DROP POLICY IF EXISTS task_completions_delete_own ON public.task_completions;
REVOKE INSERT, UPDATE, DELETE ON public.task_completions FROM authenticated;
GRANT SELECT ON public.task_completions TO authenticated;
GRANT ALL ON public.task_completions TO service_role;

DROP POLICY IF EXISTS daily_top_tasks_own ON public.daily_top_tasks;
CREATE POLICY daily_top_tasks_select_own ON public.daily_top_tasks
FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY daily_top_tasks_insert_own ON public.daily_top_tasks
FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND done = false AND coins_awarded = 0);
CREATE POLICY daily_top_tasks_update_own ON public.daily_top_tasks
FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
REVOKE DELETE ON public.daily_top_tasks FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON public.daily_top_tasks TO authenticated;
GRANT ALL ON public.daily_top_tasks TO service_role;

REVOKE ALL ON FUNCTION public.protect_verified_reward_fields() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.protect_verified_reward_fields() TO authenticated, service_role;