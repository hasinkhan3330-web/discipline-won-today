
-- 1. Country on profile (user-editable, no GPS)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS country text NOT NULL DEFAULT 'IN';
UPDATE public.profiles SET country = 'IN' WHERE country IS NULL OR length(country) <> 2;

-- 2. Trusted, server-written score events (non-purchasable Discipline Points)
CREATE TABLE IF NOT EXISTS public.score_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  points integer NOT NULL CHECK (points > 0 AND points <= 500),
  kind text NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.score_events TO authenticated;
GRANT ALL ON public.score_events TO service_role;
ALTER TABLE public.score_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "score_events_select_own" ON public.score_events;
CREATE POLICY "score_events_select_own" ON public.score_events
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS score_events_user_time_idx ON public.score_events(user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS coin_tx_user_time_idx ON public.coin_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS coin_tx_time_idx ON public.coin_transactions(created_at DESC) WHERE amount > 0;
CREATE INDEX IF NOT EXISTS profiles_country_idx ON public.profiles(country);

-- 3. Internal scoring helper (not client callable)
CREATE OR REPLACE FUNCTION public.leaderboard_scores(_period text)
RETURNS TABLE(user_id uuid, points integer, reached_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  WITH win AS (
    SELECT CASE WHEN lower(coalesce(_period,'weekly')) = 'alltime'
                THEN '-infinity'::timestamptz
                ELSE date_trunc('week', now()) END AS since
  ),
  ct AS (
    SELECT c.user_id AS uid, sum(c.amount)::int AS pts, max(c.created_at) AS last_at
    FROM public.coin_transactions c, win w
    WHERE c.amount > 0 AND c.created_at >= w.since
    GROUP BY c.user_id
  ),
  se AS (
    SELECT s.user_id AS uid, sum(s.points)::int AS pts, max(s.occurred_at) AS last_at
    FROM public.score_events s, win w
    WHERE s.occurred_at >= w.since
    GROUP BY s.user_id
  ),
  u AS (SELECT * FROM ct UNION ALL SELECT * FROM se)
  SELECT u.uid, sum(u.pts)::int, max(u.last_at) FROM u GROUP BY u.uid;
$$;
REVOKE ALL ON FUNCTION public.leaderboard_scores(text) FROM PUBLIC, anon, authenticated;

-- 4. Top 100 leaderboard (India / Global, weekly / all-time)
CREATE OR REPLACE FUNCTION public.leaderboard_top(
  _scope text DEFAULT 'global',
  _period text DEFAULT 'weekly',
  _limit integer DEFAULT 100,
  _offset integer DEFAULT 0
)
RETURNS TABLE(
  rank integer, user_id uuid, username text, avatar_url text, country text,
  points integer, consistency integer, elite boolean, is_me boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  WITH s AS (SELECT * FROM public.leaderboard_scores(_period)),
  r AS (
    SELECT p.id,
           coalesce(nullif(trim(p.username),''), nullif(trim(p.display_name),''), 'Warrior') AS uname,
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
$$;
REVOKE ALL ON FUNCTION public.leaderboard_top(text,text,integer,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.leaderboard_top(text,text,integer,integer) TO authenticated;

-- 5. Current user rank + percentile + next milestone
CREATE OR REPLACE FUNCTION public.my_leaderboard_position(
  _scope text DEFAULT 'global',
  _period text DEFAULT 'weekly'
)
RETURNS TABLE(
  rank integer, total integer, percentile integer, points integer,
  consistency integer, country text, elite boolean,
  next_milestone integer, points_to_next integer, in_top100 boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  WITH me AS (SELECT auth.uid() AS uid),
  s AS (SELECT * FROM public.leaderboard_scores(_period)),
  r AS (
    SELECT p.id,
           s.points AS pts,
           greatest(p.longest_streak, p.streak) AS cons,
           upper(coalesce(nullif(p.country,''),'IN')) AS cc,
           RANK() OVER (ORDER BY s.points DESC, greatest(p.longest_streak, p.streak) DESC, s.reached_at ASC)::int AS rnk
    FROM s JOIN public.profiles p ON p.id = s.user_id
    WHERE s.points > 0
      AND (lower(coalesce(_scope,'global')) <> 'india' OR upper(coalesce(nullif(p.country,''),'IN')) = 'IN')
  ),
  tot AS (SELECT count(*)::int AS n FROM r),
  mine AS (SELECT * FROM r, me WHERE r.id = me.uid),
  milestones AS (SELECT unnest(ARRAY[100,250,500,1000,2500,5000,10000,25000,50000]) AS m)
  SELECT
    coalesce((SELECT rnk FROM mine), 0),
    (SELECT n FROM tot),
    CASE WHEN (SELECT n FROM tot) > 0 AND (SELECT rnk FROM mine) IS NOT NULL
         THEN greatest(1, least(99, (100 - ((SELECT rnk FROM mine)::numeric / (SELECT n FROM tot) * 100))::int))
         ELSE 0 END,
    coalesce((SELECT pts FROM mine), 0),
    coalesce((SELECT cons FROM mine), 0),
    coalesce((SELECT cc FROM mine), (SELECT upper(coalesce(nullif(p.country,''),'IN')) FROM public.profiles p, me WHERE p.id = me.uid), 'IN'),
    coalesce((SELECT coalesce(sum(c.amount),0) FROM public.coin_transactions c, me
               WHERE c.user_id = me.uid AND c.amount > 0), 0) >= 5000,
    coalesce((SELECT min(m) FROM milestones WHERE m > coalesce((SELECT pts FROM mine),0)), 50000),
    greatest(0, coalesce((SELECT min(m) FROM milestones WHERE m > coalesce((SELECT pts FROM mine),0)), 50000) - coalesce((SELECT pts FROM mine),0)),
    coalesce((SELECT rnk FROM mine), 9999) <= 100;
$$;
REVOKE ALL ON FUNCTION public.my_leaderboard_position(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.my_leaderboard_position(text,text) TO authenticated;

-- 6. Avatars readable by signed-in members (leaderboard photos); writes stay owner-only
DROP POLICY IF EXISTS "avatars read all authenticated" ON storage.objects;
CREATE POLICY "avatars read all authenticated" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'avatars');
