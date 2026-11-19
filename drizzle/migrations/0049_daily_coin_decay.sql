CREATE TABLE public.daily_coin_decay (
  user_id uuid NOT NULL,
  local_day date NOT NULL,
  earned integer NOT NULL,
  penalized boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, local_day)
);
GRANT ALL ON public.daily_coin_decay TO service_role;
ALTER TABLE public.daily_coin_decay ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.axen_apply_coin_decay(_uid uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _launch timestamptz := '2026-11-19 17:30:00+00';
  _tz text; _created timestamptz; _coins int;
  _today date; _from date; _d date; _last date;
  _earned int; _n int := 0;
BEGIN
  SELECT p.reward_timezone, p.created_at, p.coins INTO _tz, _created, _coins
    FROM public.profiles p WHERE p.id = _uid FOR UPDATE;
  IF NOT FOUND THEN RETURN 0; END IF;
  IF _tz IS NULL OR NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = _tz) THEN _tz := 'UTC'; END IF;
  PERFORM set_config('app.economy_write', 'on', true);
  _today := (now() AT TIME ZONE _tz)::date;
  SELECT max(local_day) INTO _last FROM public.daily_coin_decay WHERE user_id = _uid;
  _from := greatest((_launch AT TIME ZONE _tz)::date,
                    (coalesce(_created, now()) AT TIME ZONE _tz)::date + 1,
                    coalesce(_last + 1, '-infinity'::date),
                    _today - 60);
  _d := _from;
  WHILE _d < _today LOOP
    SELECT coalesce(sum(ct.amount), 0) INTO _earned FROM public.coin_transactions ct
      WHERE ct.user_id = _uid AND ct.amount > 0
        AND (ct.created_at AT TIME ZONE _tz)::date = _d
        AND ct.reason NOT IN ('streak_milestone','referral','gift','shield_purchase','shield_refund','pact_hold','pact_refund','pact_payout');
    INSERT INTO public.daily_coin_decay(user_id, local_day, earned, penalized)
      VALUES (_uid, _d, _earned, _earned < 15) ON CONFLICT DO NOTHING;
    IF FOUND AND _earned < 15 THEN
      UPDATE public.profiles SET coins = coins - 3 WHERE id = _uid;
      INSERT INTO public.coin_transactions(user_id, amount, reason, reward_local_date)
        VALUES (_uid, -3, 'Daily penalty -3', _d);
      _n := _n + 1;
    END IF;
    _d := _d + 1;
  END LOOP;
  RETURN _n;
END; $$;
REVOKE ALL ON FUNCTION public.axen_apply_coin_decay(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.axen_apply_coin_decay(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.axen_run_coin_decay_all()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; _n int := 0;
BEGIN
  FOR r IN SELECT id FROM public.profiles LOOP
    BEGIN
      _n := _n + public.axen_apply_coin_decay(r.id);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'coin decay failed for %: %', r.id, SQLERRM;
    END;
  END LOOP;
  RETURN _n;
END; $$;
REVOKE ALL ON FUNCTION public.axen_run_coin_decay_all() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.axen_run_coin_decay_all() TO service_role;

CREATE OR REPLACE FUNCTION public.apply_daily_penalty()
 RETURNS TABLE(coins integer, penalized boolean)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _uid uuid := auth.uid(); _n int;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  _n := public.axen_apply_coin_decay(_uid);
  SELECT p.coins INTO coins FROM public.profiles p WHERE p.id = _uid;
  penalized := _n > 0; RETURN NEXT;
END; $function$;