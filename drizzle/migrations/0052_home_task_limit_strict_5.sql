WITH a AS (
  SELECT t.id, t.user_id, t.name, t.created_at,
         (SELECT max(c.created_at) FROM public.task_completions c WHERE c.task_id = t.id) lastc
  FROM public.tasks t
  WHERE t.is_active AND t.archived_at IS NULL
    AND NOT EXISTS (SELECT 1 FROM public.coach_plan_materialized m WHERE m.task_id = t.id)
), rk AS (
  SELECT id, row_number() OVER (PARTITION BY user_id ORDER BY (name ~* 'wake') DESC, lastc DESC NULLS LAST, created_at DESC, id DESC) r FROM a
)
UPDATE public.tasks t SET archived_prev_active = t.is_active, is_active = false,
  archived_at = now(), archived_reason = 'over_limit_v2'
FROM rk WHERE rk.id = t.id AND rk.r > 5;

CREATE OR REPLACE FUNCTION public.enforce_task_limit()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _count int;
BEGIN
  IF NOT (NEW.is_active AND NEW.archived_at IS NULL) THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.is_active THEN RETURN NEW; END IF;
  PERFORM pg_advisory_xact_lock(hashtext(NEW.user_id::text));
  SELECT count(*) INTO _count
  FROM public.tasks t
  WHERE t.user_id = NEW.user_id AND t.id <> NEW.id AND t.is_active AND t.archived_at IS NULL
    AND NOT EXISTS (SELECT 1 FROM public.coach_plan_materialized m WHERE m.task_id = t.id);
  IF _count >= 5 THEN
    RAISE EXCEPTION 'Home task limit reached (5). Archive or delete a task to add a new one.';
  END IF;
  RETURN NEW;
END;
$function$;