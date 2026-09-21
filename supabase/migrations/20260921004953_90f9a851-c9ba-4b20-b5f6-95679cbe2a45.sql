UPDATE public.tasks
SET pts = 10
WHERE lower(trim(name)) IN ('workout', 'gym', 'workout/gym');

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM set_config('app.economy_write', 'on', true);

  INSERT INTO public.profiles (id, display_name, trial_ends_at, is_subscribed)
  VALUES (
    NEW.id,
    COALESCE(
      nullif(trim(NEW.raw_user_meta_data->>'display_name'), ''),
      nullif(trim(NEW.raw_user_meta_data->>'full_name'), ''),
      nullif(trim(NEW.raw_user_meta_data->>'name'), ''),
      split_part(NEW.email, '@', 1)
    ),
    now() + interval '3 days',
    false
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.tasks (user_id, icon, name, pts, sort_order) VALUES
    (NEW.id, '🌅', 'Wake Up 4AM', 21, 1),
    (NEW.id, '🚿', 'Cold Shower', 10, 2),
    (NEW.id, '💪', 'Workout', 10, 3),
    (NEW.id, '📚', 'Deep Focus', 8, 4),
    (NEW.id, '🎯', 'Top 3 Missions', 20, 5);

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.complete_zen_session(_minutes integer)
RETURNS TABLE(coins integer, awarded integer, minutes integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _mins integer := LEAST(GREATEST(coalesce(_minutes, 0), 0), 60);
  _pts integer := 5;
  _last timestamptz;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _mins < 5 THEN RAISE EXCEPTION 'session too short'; END IF;

  SELECT max(fs.created_at) INTO _last FROM public.focus_sessions fs
    WHERE fs.user_id = _uid AND fs.tier = 'zen';
  IF _last IS NOT NULL AND _last > now() - (_mins || ' minutes')::interval THEN
    RAISE EXCEPTION 'zen session too soon';
  END IF;

  PERFORM set_config('app.economy_write', 'on', true);

  INSERT INTO public.focus_sessions(user_id, tier, minutes, coins_awarded, lock_mode, blocked_apps)
  VALUES (_uid, 'zen', _mins, _pts, 'flex', '{}');

  UPDATE public.profiles p SET coins = p.coins + _pts WHERE p.id = _uid;
  INSERT INTO public.coin_transactions(user_id, amount, reason) VALUES (_uid, _pts, 'zen');

  SELECT p.coins INTO coins FROM public.profiles p WHERE p.id = _uid;
  awarded := _pts;
  minutes := _mins;
  RETURN NEXT;
END;
$function$;

CREATE OR REPLACE FUNCTION public.complete_focus_session(_tier text, _lock_mode text DEFAULT 'strict'::text, _blocked_apps text[] DEFAULT '{}'::text[])
RETURNS TABLE(coins integer, awarded integer, minutes integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _pts integer;
  _mins integer;
  _last timestamptz;
  _paid boolean;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.subscriptions s
    WHERE s.user_id = _uid
      AND (
        (s.status IN ('active', 'trialing', 'past_due') AND (s.current_period_end IS NULL OR s.current_period_end > now()))
        OR (s.status = 'canceled' AND s.current_period_end > now())
      )
  ) INTO _paid;
  IF NOT _paid THEN RAISE EXCEPTION 'AXEN Pro subscription required'; END IF;

  IF _tier = 'f49' THEN _pts := 5; _mins := 49;
  ELSIF _tier = 'f120' THEN _pts := 10; _mins := 120;
  ELSIF _tier = 'f229' THEN _pts := 15; _mins := 180;
  ELSE RAISE EXCEPTION 'invalid tier';
  END IF;

  SELECT max(fs.created_at) INTO _last
  FROM public.focus_sessions fs
  WHERE fs.user_id = _uid;
  IF _last IS NOT NULL AND _last > now() - (_mins || ' minutes')::interval THEN
    RAISE EXCEPTION 'focus session too soon';
  END IF;

  PERFORM set_config('app.economy_write', 'on', true);

  INSERT INTO public.focus_sessions(user_id, tier, minutes, coins_awarded, lock_mode, blocked_apps)
  VALUES (_uid, _tier, _mins, _pts, coalesce(_lock_mode, 'strict'), coalesce(_blocked_apps, '{}'));

  UPDATE public.profiles p SET coins = p.coins + _pts WHERE p.id = _uid;
  INSERT INTO public.coin_transactions(user_id, amount, reason) VALUES (_uid, _pts, 'focus');

  SELECT p.coins INTO coins FROM public.profiles p WHERE p.id = _uid;
  awarded := _pts;
  minutes := _mins;
  RETURN NEXT;
END;
$function$;

REVOKE ALL ON FUNCTION public.complete_zen_session(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_zen_session(integer) TO authenticated;
GRANT ALL ON FUNCTION public.complete_zen_session(integer) TO service_role;
REVOKE ALL ON FUNCTION public.complete_focus_session(text, text, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_focus_session(text, text, text[]) TO authenticated;
GRANT ALL ON FUNCTION public.complete_focus_session(text, text, text[]) TO service_role;