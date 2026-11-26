CREATE TABLE IF NOT EXISTS public.workout_proof_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  task_id uuid NOT NULL,
  workout_type text NOT NULL,
  verified boolean NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workout_proof_attempts_user_created
  ON public.workout_proof_attempts (user_id, created_at DESC);

GRANT SELECT ON public.workout_proof_attempts TO authenticated;
GRANT ALL ON public.workout_proof_attempts TO service_role;

ALTER TABLE public.workout_proof_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own workout proof attempts" ON public.workout_proof_attempts;
CREATE POLICY "Users can view own workout proof attempts"
  ON public.workout_proof_attempts
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.complete_workout_with_proof(
  _uid uuid,
  _task_id uuid,
  _workout_type text
)
RETURNS TABLE(coins integer, streak integer, longest_streak integer, awarded integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _name text;
  _pts integer;
  _today date := (now() AT TIME ZONE 'utc')::date;
  _last date;
  _new_streak integer;
  _inserted boolean := false;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(_uid::text, 74099));

  IF EXISTS (SELECT 1 FROM public.coach_plan_materialized m WHERE m.task_id = _task_id) THEN
    RAISE EXCEPTION 'Coach plan tasks are tracked in My Plan and do not earn rewards';
  END IF;
  IF EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = _task_id AND t.archived_at IS NOT NULL) THEN
    RAISE EXCEPTION 'task is archived';
  END IF;

  SELECT t.name INTO _name
  FROM public.tasks t
  WHERE t.id = _task_id AND t.user_id = _uid AND t.is_active;
  IF _name IS NULL THEN RAISE EXCEPTION 'task not found'; END IF;

  _pts := LEAST(10, public.axen_daily_coin_room(_uid));
  PERFORM set_config('app.economy_write', 'on', true);

  INSERT INTO public.task_completions(user_id, task_id, completed_on, coins_awarded)
  VALUES (_uid, _task_id, _today, _pts)
  ON CONFLICT (user_id, task_id, completed_on) DO NOTHING;
  GET DIAGNOSTICS _inserted = ROW_COUNT;

  IF NOT _inserted THEN
    SELECT p.coins, p.streak, p.longest_streak
    INTO coins, streak, longest_streak
    FROM public.profiles p WHERE p.id = _uid;
    awarded := 0;
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT p.last_activity_date INTO _last FROM public.profiles p WHERE p.id = _uid;
  IF _last = _today THEN
    SELECT p.streak INTO _new_streak FROM public.profiles p WHERE p.id = _uid;
  ELSIF _last = _today - 1 THEN
    SELECT p.streak + 1 INTO _new_streak FROM public.profiles p WHERE p.id = _uid;
  ELSE
    _new_streak := 1;
  END IF;

  UPDATE public.profiles p
  SET coins = p.coins + _pts,
      streak = _new_streak,
      longest_streak = GREATEST(p.longest_streak, _new_streak),
      last_activity_date = _today
  WHERE p.id = _uid;

  IF _pts > 0 THEN
    INSERT INTO public.coin_transactions(user_id, amount, reason, ref_id)
    VALUES (_uid, _pts, 'workout_proof', _task_id);
  END IF;

  SELECT p.coins, p.streak, p.longest_streak
  INTO coins, streak, longest_streak
  FROM public.profiles p WHERE p.id = _uid;
  awarded := _pts;
  RETURN NEXT;
END;
$function$;

REVOKE ALL ON FUNCTION public.complete_workout_with_proof(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_workout_with_proof(uuid, uuid, text) TO service_role;