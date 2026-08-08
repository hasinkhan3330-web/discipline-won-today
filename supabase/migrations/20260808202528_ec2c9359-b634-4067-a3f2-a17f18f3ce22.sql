CREATE TABLE public.focus_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tier text NOT NULL,
  minutes integer NOT NULL,
  coins_awarded integer NOT NULL DEFAULT 0,
  lock_mode text NOT NULL DEFAULT 'strict',
  blocked_apps text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.focus_sessions TO authenticated;
GRANT ALL ON public.focus_sessions TO service_role;

ALTER TABLE public.focus_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY focus_sessions_select_own ON public.focus_sessions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE INDEX focus_sessions_user_created_idx ON public.focus_sessions (user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.complete_focus_session(_tier text, _lock_mode text DEFAULT 'strict', _blocked_apps text[] DEFAULT '{}')
RETURNS TABLE(coins integer, awarded integer, minutes integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _pts integer;
  _mins integer;
  _last timestamptz;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  IF _tier = 'f49' THEN _pts := 15; _mins := 49;
  ELSIF _tier = 'f120' THEN _pts := 25; _mins := 120;
  ELSIF _tier = 'f229' THEN _pts := 40; _mins := 229;
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
END; $$;

REVOKE ALL ON FUNCTION public.complete_focus_session(text, text, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_focus_session(text, text, text[]) TO authenticated;