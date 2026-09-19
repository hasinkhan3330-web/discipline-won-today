CREATE OR REPLACE FUNCTION public.save_onboarding_step(_step integer, _answers jsonb)
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _name text;
  _age text;
  _minor boolean;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000';
  END IF;
  IF _step < 1 OR _step > 13 THEN
    RAISE EXCEPTION 'invalid onboarding step' USING ERRCODE = '22023';
  END IF;
  IF _answers IS NULL OR jsonb_typeof(_answers) <> 'object' THEN
    RAISE EXCEPTION 'invalid onboarding answers' USING ERRCODE = '22023';
  END IF;

  _name := nullif(left(trim(coalesce(_answers->>'preferred_name', '')), 60), '');
  IF _answers ? 'preferred_name' AND _name IS NULL THEN
    RAISE EXCEPTION 'name is required' USING ERRCODE = '22023';
  END IF;

  _age := nullif(trim(coalesce(_answers->>'age_range', '')), '');
  _minor := coalesce(_age IN ('under_13', '13_17'), false);

  INSERT INTO public.profiles (
    id, display_name, preferred_name, age_range, acquisition_source,
    primary_goal, first_habit, social_hours_daily, biggest_distraction,
    wake_time, sleep_time, consistency_days, routine_breaker,
    preferred_focus_time, commitment_milestone, onboarding_step,
    onboarding_version, safe_minor_mode, behavioral_tracking_allowed,
    updated_at
  ) VALUES (
    _uid,
    _name,
    _name,
    _age,
    left(nullif(trim(coalesce(_answers->>'acquisition_source', '')), ''), 40),
    left(nullif(trim(coalesce(_answers->>'primary_goal', '')), ''), 40),
    left(nullif(trim(coalesce(_answers->>'first_habit', '')), ''), 100),
    CASE WHEN _answers ? 'social_hours_daily' THEN LEAST(12, GREATEST(0, (_answers->>'social_hours_daily')::numeric)) ELSE NULL END,
    left(nullif(trim(coalesce(_answers->>'biggest_distraction', '')), ''), 40),
    CASE WHEN _answers ? 'wake_time' THEN nullif(_answers->>'wake_time', '')::time ELSE NULL END,
    CASE WHEN _answers ? 'sleep_time' THEN nullif(_answers->>'sleep_time', '')::time ELSE NULL END,
    CASE WHEN _answers ? 'consistency_days' THEN LEAST(7, GREATEST(0, (_answers->>'consistency_days')::integer)) ELSE NULL END,
    left(nullif(trim(coalesce(_answers->>'routine_breaker', '')), ''), 40),
    left(nullif(trim(coalesce(_answers->>'preferred_focus_time', '')), ''), 40),
    CASE WHEN _answers ? 'commitment_milestone' AND (_answers->>'commitment_milestone')::integer IN (21,60,90) THEN (_answers->>'commitment_milestone')::integer ELSE NULL END,
    _step,
    2,
    _minor,
    NOT _minor,
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    display_name = CASE WHEN _answers ? 'preferred_name' THEN _name ELSE profiles.display_name END,
    preferred_name = CASE WHEN _answers ? 'preferred_name' THEN _name ELSE profiles.preferred_name END,
    age_range = CASE WHEN _answers ? 'age_range' THEN _age ELSE profiles.age_range END,
    acquisition_source = CASE WHEN _answers ? 'acquisition_source' THEN left(nullif(trim(_answers->>'acquisition_source'), ''), 40) ELSE profiles.acquisition_source END,
    primary_goal = CASE WHEN _answers ? 'primary_goal' THEN left(nullif(trim(_answers->>'primary_goal'), ''), 40) ELSE profiles.primary_goal END,
    first_habit = CASE WHEN _answers ? 'first_habit' THEN left(nullif(trim(_answers->>'first_habit'), ''), 100) ELSE profiles.first_habit END,
    social_hours_daily = CASE WHEN _answers ? 'social_hours_daily' THEN LEAST(12, GREATEST(0, (_answers->>'social_hours_daily')::numeric)) ELSE profiles.social_hours_daily END,
    biggest_distraction = CASE WHEN _answers ? 'biggest_distraction' THEN left(nullif(trim(_answers->>'biggest_distraction'), ''), 40) ELSE profiles.biggest_distraction END,
    wake_time = CASE WHEN _answers ? 'wake_time' THEN nullif(_answers->>'wake_time', '')::time ELSE profiles.wake_time END,
    sleep_time = CASE WHEN _answers ? 'sleep_time' THEN nullif(_answers->>'sleep_time', '')::time ELSE profiles.sleep_time END,
    consistency_days = CASE WHEN _answers ? 'consistency_days' THEN LEAST(7, GREATEST(0, (_answers->>'consistency_days')::integer)) ELSE profiles.consistency_days END,
    routine_breaker = CASE WHEN _answers ? 'routine_breaker' THEN left(nullif(trim(_answers->>'routine_breaker'), ''), 40) ELSE profiles.routine_breaker END,
    preferred_focus_time = CASE WHEN _answers ? 'preferred_focus_time' THEN left(nullif(trim(_answers->>'preferred_focus_time'), ''), 40) ELSE profiles.preferred_focus_time END,
    commitment_milestone = CASE WHEN _answers ? 'commitment_milestone' AND (_answers->>'commitment_milestone')::integer IN (21,60,90) THEN (_answers->>'commitment_milestone')::integer ELSE profiles.commitment_milestone END,
    onboarding_step = GREATEST(profiles.onboarding_step, _step),
    onboarding_version = 2,
    safe_minor_mode = CASE WHEN _answers ? 'age_range' THEN _minor ELSE profiles.safe_minor_mode END,
    behavioral_tracking_allowed = CASE WHEN _answers ? 'age_range' THEN NOT _minor ELSE profiles.behavioral_tracking_allowed END,
    updated_at = now();
END;
$function$;

REVOKE ALL ON FUNCTION public.save_onboarding_step(integer, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_onboarding_step(integer, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_onboarding_step(integer, jsonb) TO service_role;