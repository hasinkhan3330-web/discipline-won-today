CREATE OR REPLACE FUNCTION public.force_app_trial_window()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  _now timestamptz := now();
BEGIN
  NEW.trial_started_at := _now;
  NEW.trial_ends_at := _now + interval '3 days';
  NEW.created_at := COALESCE(NEW.created_at, _now);
  NEW.updated_at := _now;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER force_app_trial_window_before_insert
  BEFORE INSERT ON public.app_trials
  FOR EACH ROW
  EXECUTE FUNCTION public.force_app_trial_window();

GRANT INSERT ON public.app_trials TO authenticated;

CREATE POLICY "Users can start own app trial"
  ON public.app_trials
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.ensure_app_trial()
RETURNS TABLE(trial_started_at timestamptz, trial_ends_at timestamptz)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  INSERT INTO public.app_trials (user_id)
  VALUES (_uid)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN QUERY
  SELECT t.trial_started_at, t.trial_ends_at
  FROM public.app_trials t
  WHERE t.user_id = _uid;
END;
$function$;

REVOKE ALL ON FUNCTION public.ensure_app_trial() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_app_trial() TO authenticated;