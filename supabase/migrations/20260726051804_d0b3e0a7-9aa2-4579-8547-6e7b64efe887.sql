CREATE TABLE public.app_trials (
  user_id uuid PRIMARY KEY,
  trial_started_at timestamptz NOT NULL DEFAULT now(),
  trial_ends_at timestamptz NOT NULL DEFAULT (now() + interval '3 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT app_trials_max_three_days CHECK (trial_ends_at <= trial_started_at + interval '3 days')
);

GRANT SELECT ON public.app_trials TO authenticated;
GRANT ALL ON public.app_trials TO service_role;

ALTER TABLE public.app_trials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own app trial"
  ON public.app_trials
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER set_app_trials_updated_at
  BEFORE UPDATE ON public.app_trials
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.ensure_app_trial()
RETURNS TABLE(trial_started_at timestamptz, trial_ends_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
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