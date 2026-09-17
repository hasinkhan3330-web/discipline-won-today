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
    (NEW.id, '🌅', 'Wake Up 4AM',  21, 1),
    (NEW.id, '🚿', 'Cold Shower',  10, 2),
    (NEW.id, '💪', 'Workout',      15, 3),
    (NEW.id, '📚', 'Deep Focus',    8, 4),
    (NEW.id, '🎯', 'Top 3 Missions', 20, 5);

  RETURN NEW;
END;
$function$;

-- Leaderboard must never expose an email-looking handle
CREATE OR REPLACE FUNCTION public.leaderboard_top(_scope text DEFAULT 'global'::text, _period text DEFAULT 'weekly'::text, _limit integer DEFAULT 100, _offset integer DEFAULT 0)
 RETURNS TABLE(rank integer, user_id uuid, username text, avatar_url text, country text, points integer, consistency integer, elite boolean, is_me boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH s AS (SELECT * FROM public.leaderboard_scores(_period)),
  r AS (
    SELECT p.id,
           split_part(coalesce(nullif(trim(p.username),''), nullif(trim(p.display_name),''), 'Warrior'), '@', 1) AS uname,
           p.avatar_url,
           upper(coalesce(nullif(p.country,''),'IN')) AS cc,
           s.points AS pts,
           greatest(p.longest_streak, p.streak) AS cons,
           s.reached_at,
           RANK() OVER (ORDER BY s.points DESC, greatest(p.longest_streak, p.streak) DESC, s.reached_at ASC)::int AS rnk
    FROM s JOIN public.profiles p ON p.id = s.user_id
    WHERE s.points > 0
      AND (lower(coalesce(_scope,'global')) <> 'india' OR upper(coalesce(nullif(p.country,''),'IN')) = 'IN')
  )
  SELECT r.rnk, r.id, r.uname, r.avatar_url, r.cc, r.pts, r.cons,
         (SELECT coalesce(sum(c.amount),0) FROM public.coin_transactions c
           WHERE c.user_id = r.id AND c.amount > 0) >= 5000,
         r.id = auth.uid()
  FROM r
  WHERE r.rnk <= 100
  ORDER BY r.rnk
  LIMIT greatest(1, least(coalesce(_limit,100), 100))
  OFFSET greatest(0, coalesce(_offset,0));
$function$;

-- Backfill real names where the stored name was derived from the email
DO $$
BEGIN
  PERFORM set_config('app.economy_write', 'on', true);
  UPDATE public.profiles p
     SET display_name = coalesce(
           nullif(trim(u.raw_user_meta_data->>'full_name'), ''),
           nullif(trim(u.raw_user_meta_data->>'name'), ''),
           split_part(u.email, '@', 1)
         )
    FROM auth.users u
   WHERE u.id = p.id
     AND (
       p.display_name IS NULL
       OR trim(p.display_name) = ''
       OR p.display_name ILIKE '%@%'
       OR p.display_name = split_part(u.email, '@', 1)
     );
  UPDATE public.profiles SET username = split_part(username, '@', 1) WHERE username ILIKE '%@%';
END $$;