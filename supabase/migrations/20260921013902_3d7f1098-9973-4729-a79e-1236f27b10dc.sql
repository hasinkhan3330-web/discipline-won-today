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
      IF NEW.done IS DISTINCT FROM false OR NEW.coins_awarded IS DISTINCT FROM 0 THEN
        RAISE EXCEPTION 'reward fields can only be set by the server';
      END IF;
    ELSE
      IF NEW.done IS DISTINCT FROM OLD.done OR NEW.coins_awarded IS DISTINCT FROM OLD.coins_awarded THEN
        RAISE EXCEPTION 'reward fields can only be changed by the server';
      END IF;
    END IF;
  ELSE
    IF TG_OP = 'INSERT' THEN
      IF NEW.coins_awarded IS DISTINCT FROM 0 THEN
        RAISE EXCEPTION 'reward fields can only be set by the server';
      END IF;
    ELSE
      IF NEW.coins_awarded IS DISTINCT FROM OLD.coins_awarded THEN
        RAISE EXCEPTION 'reward fields can only be changed by the server';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.protect_verified_reward_fields() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.protect_verified_reward_fields() TO authenticated, service_role;