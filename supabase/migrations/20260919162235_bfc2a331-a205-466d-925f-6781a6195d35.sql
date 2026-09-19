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
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  IF _tier = 'f49' THEN _pts := 15; _mins := 49;
  ELSIF _tier = 'f120' THEN _pts := 25; _mins := 120;
  ELSIF _tier = 'f229' THEN _pts := 40; _mins := 180;
  ELSE RAISE EXCEPTION 'invalid tier';
  END IF;

  -- anti-abuse: a session cannot be credited faster than its own duration
  SELECT max(fs.created_at) INTO _last FROM public.focus_sessions fs WHERE fs.user_id = _uid;
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
END; $function$;

CREATE OR REPLACE FUNCTION public.leave_pact(_pact_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _rows integer;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  UPDATE public.accountability_pacts p
     SET status = 'ended'
   WHERE p.id = _pact_id
     AND p.status = 'active'
     AND (p.owner_id = _uid OR p.partner_id = _uid);

  GET DIAGNOSTICS _rows = ROW_COUNT;
  RETURN _rows > 0;
END; $function$;

REVOKE ALL ON FUNCTION public.leave_pact(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.leave_pact(uuid) TO authenticated;