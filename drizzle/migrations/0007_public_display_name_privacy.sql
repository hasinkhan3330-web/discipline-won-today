CREATE OR REPLACE FUNCTION public.axen_public_display_name(_display_name text, _user_id uuid)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path TO '' AS $$
  SELECT CASE WHEN nullif(btrim(_display_name), '') IS NOT NULL AND position('@' IN _display_name) = 0
    THEN btrim(_display_name) ELSE 'Axen Member ' || right(_user_id::text, 4) END;
$$;
REVOKE ALL ON FUNCTION public.axen_public_display_name(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.axen_public_display_name(text, uuid) TO anon, authenticated, service_role;

-- Preserve the existing view columns, access settings and grants. No email is read.
CREATE OR REPLACE VIEW public.public_profiles AS
SELECT id,
  public.axen_public_display_name(display_name, id) AS display_name,
  public.axen_public_display_name(display_name, id) AS username,
  avatar_url, coins, streak, longest_streak
FROM public.profiles;

-- Only name expressions change; signatures, privileges, filtering, reward and relationship logic remain identical.
DO $$
DECLARE _definition text; _updated text;
BEGIN
  SELECT pg_get_functiondef('public.leaderboard_top(text,text,integer,integer)'::regprocedure) INTO _definition;
  _updated := replace(_definition,
    'split_part(coalesce(nullif(trim(p.username),''''), nullif(trim(p.display_name),''''), ''Warrior''), ''@'', 1)',
    'public.axen_public_display_name(p.display_name, p.id)');
  IF _updated = _definition THEN RAISE EXCEPTION 'leaderboard name expression mismatch'; END IF;
  EXECUTE _updated;

  SELECT pg_get_functiondef('public.get_my_accountability()'::regprocedure) INTO _definition;
  _updated := replace(_definition, 'coalesce(p.display_name, p.username, ''Partner'')', 'public.axen_public_display_name(p.display_name, p.id)');
  IF _updated = _definition THEN RAISE EXCEPTION 'partner name expression mismatch'; END IF;
  EXECUTE _updated;

  SELECT pg_get_functiondef('public.get_partner_reviews()'::regprocedure) INTO _definition;
  _updated := replace(_definition, 'coalesce(p.display_name, p.username, ''Partner'')', 'public.axen_public_display_name(p.display_name, p.id)');
  IF _updated = _definition THEN RAISE EXCEPTION 'review name expression mismatch'; END IF;
  EXECUTE _updated;

  SELECT pg_get_functiondef('public.list_friends()'::regprocedure) INTO _definition;
  _updated := replace(replace(_definition, 'p.display_name,', 'public.axen_public_display_name(p.display_name, p.id),'), 'p.username,', 'public.axen_public_display_name(p.display_name, p.id),');
  IF _updated = _definition THEN RAISE EXCEPTION 'friend name expression mismatch'; END IF;
  EXECUTE _updated;

  SELECT pg_get_functiondef('public.send_accountability_nudge(uuid,text,text)'::regprocedure) INTO _definition;
  _updated := replace(_definition, 'coalesce(nullif(btrim(p.username), ''''), nullif(btrim(p.display_name), ''''), ''Partner'')', 'public.axen_public_display_name(p.display_name, p.id)');
  IF _updated = _definition THEN RAISE EXCEPTION 'checkin name expression mismatch'; END IF;
  EXECUTE _updated;

  SELECT pg_get_functiondef('public.get_pact_status()'::regprocedure) INTO _definition;
  _updated := replace(_definition, 'COALESCE((SELECT pr.display_name FROM public.profiles pr WHERE pr.id = o.oid),
             (SELECT pr.username FROM public.profiles pr WHERE pr.id = o.oid), ''Partner'')',
    '(SELECT public.axen_public_display_name(pr.display_name, pr.id) FROM public.profiles pr WHERE pr.id = o.oid)');
  IF _updated = _definition THEN RAISE EXCEPTION 'legacy partner name expression mismatch'; END IF;
  EXECUTE _updated;
END;
$$;