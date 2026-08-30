CREATE OR REPLACE FUNCTION public.get_or_create_referral_code()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _code text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT p.referral_code INTO _code FROM public.profiles p WHERE p.id = _uid;
  IF _code IS NOT NULL THEN RETURN _code; END IF;

  PERFORM set_config('app.economy_write', 'on', true);
  FOR i IN 1..8 LOOP
    -- gen_random_uuid() is a core function, unlike pgcrypto's gen_random_bytes(),
    -- which is not on this function's search_path.
    _code := 'AXEN' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    BEGIN
      UPDATE public.profiles p SET referral_code = _code WHERE p.id = _uid;
      RETURN _code;
    EXCEPTION WHEN unique_violation THEN
      NULL;
    END;
  END LOOP;
  RAISE EXCEPTION 'could not allocate referral code';
END; $function$;