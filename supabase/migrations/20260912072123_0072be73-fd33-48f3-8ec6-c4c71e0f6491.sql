CREATE TABLE public.accountability_pacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  partner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  daily_target int NOT NULL DEFAULT 3 CHECK (daily_target BETWEEN 1 AND 10),
  stake_coins int NOT NULL DEFAULT 0 CHECK (stake_coins BETWEEN 0 AND 200),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','ended')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (owner_id <> partner_id)
);
CREATE UNIQUE INDEX accountability_pacts_owner_active
  ON public.accountability_pacts(owner_id) WHERE status = 'active';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.accountability_pacts TO authenticated;
GRANT ALL ON public.accountability_pacts TO service_role;
ALTER TABLE public.accountability_pacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pact_read_participants" ON public.accountability_pacts
  FOR SELECT TO authenticated
  USING (auth.uid() = owner_id OR auth.uid() = partner_id);
CREATE POLICY "pact_owner_insert" ON public.accountability_pacts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "pact_owner_update" ON public.accountability_pacts
  FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "pact_owner_delete" ON public.accountability_pacts
  FOR DELETE TO authenticated USING (auth.uid() = owner_id);

CREATE TRIGGER accountability_pacts_updated_at
  BEFORE UPDATE ON public.accountability_pacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.pact_nudges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pact_id uuid NOT NULL REFERENCES public.accountability_pacts(id) ON DELETE CASCADE,
  from_user uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_user uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message text NOT NULL CHECK (char_length(message) BETWEEN 1 AND 200),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX pact_nudges_to_user_idx ON public.pact_nudges(to_user, created_at DESC);

GRANT SELECT, INSERT ON public.pact_nudges TO authenticated;
GRANT ALL ON public.pact_nudges TO service_role;
ALTER TABLE public.pact_nudges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "nudge_read_participants" ON public.pact_nudges
  FOR SELECT TO authenticated
  USING (auth.uid() = from_user OR auth.uid() = to_user);
CREATE POLICY "nudge_send_own" ON public.pact_nudges
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = from_user
    AND EXISTS (
      SELECT 1 FROM public.accountability_pacts p
      WHERE p.id = pact_id AND p.status = 'active'
        AND (auth.uid() = p.owner_id OR auth.uid() = p.partner_id)
        AND to_user = CASE WHEN auth.uid() = p.owner_id THEN p.partner_id ELSE p.owner_id END
    )
  );

CREATE OR REPLACE FUNCTION public.get_pact_status()
RETURNS TABLE (
  pact_id uuid,
  role text,
  daily_target int,
  stake_coins int,
  me_done_today int,
  me_total_today int,
  me_streak int,
  partner_id uuid,
  partner_name text,
  partner_avatar text,
  partner_done_today int,
  partner_total_today int,
  partner_streak int,
  last_nudge text,
  last_nudge_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH me AS (SELECT auth.uid() AS uid),
  p AS (
    SELECT ap.* FROM public.accountability_pacts ap, me
    WHERE ap.status = 'active' AND (ap.owner_id = me.uid OR ap.partner_id = me.uid)
    LIMIT 1
  ),
  other AS (
    SELECT p.id, CASE WHEN p.owner_id = (SELECT uid FROM me) THEN p.partner_id ELSE p.owner_id END AS oid FROM p
  )
  SELECT
    p.id,
    CASE WHEN p.owner_id = (SELECT uid FROM me) THEN 'owner' ELSE 'partner' END,
    p.daily_target,
    p.stake_coins,
    (SELECT count(*)::int FROM public.task_completions tc WHERE tc.user_id = (SELECT uid FROM me) AND tc.completed_on = CURRENT_DATE),
    (SELECT count(*)::int FROM public.tasks t WHERE t.user_id = (SELECT uid FROM me) AND t.is_active),
    (SELECT pr.streak FROM public.profiles pr WHERE pr.id = (SELECT uid FROM me)),
    o.oid,
    COALESCE((SELECT pr.display_name FROM public.profiles pr WHERE pr.id = o.oid),
             (SELECT pr.username FROM public.profiles pr WHERE pr.id = o.oid), 'Partner'),
    (SELECT pr.avatar_url FROM public.profiles pr WHERE pr.id = o.oid),
    (SELECT count(*)::int FROM public.task_completions tc WHERE tc.user_id = o.oid AND tc.completed_on = CURRENT_DATE),
    (SELECT count(*)::int FROM public.tasks t WHERE t.user_id = o.oid AND t.is_active),
    (SELECT pr.streak FROM public.profiles pr WHERE pr.id = o.oid),
    (SELECT n.message FROM public.pact_nudges n WHERE n.pact_id = p.id AND n.to_user = (SELECT uid FROM me) ORDER BY n.created_at DESC LIMIT 1),
    (SELECT n.created_at FROM public.pact_nudges n WHERE n.pact_id = p.id AND n.to_user = (SELECT uid FROM me) ORDER BY n.created_at DESC LIMIT 1)
  FROM p JOIN other o ON o.id = p.id
  WHERE public.has_premium_access(auth.uid());
$$;

REVOKE ALL ON FUNCTION public.get_pact_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_pact_status() TO authenticated;

CREATE OR REPLACE FUNCTION public.rank_scan()
RETURNS TABLE (
  coins int,
  coin_rank int,
  total_users int,
  percentile int,
  streak int,
  streak_rank int,
  longest_streak int,
  consistency_30d int,
  completions_30d int,
  active_habits int,
  best_habit text,
  best_habit_rate int,
  weakest_habit text,
  weakest_habit_rate int
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH me AS (SELECT auth.uid() AS uid),
  mine AS (SELECT pr.* FROM public.profiles pr, me WHERE pr.id = me.uid),
  totals AS (SELECT count(*)::int AS n FROM public.profiles),
  ranks AS (
    SELECT
      (SELECT count(*)::int + 1 FROM public.profiles pr WHERE pr.coins > (SELECT coins FROM mine)) AS coin_rank,
      (SELECT count(*)::int + 1 FROM public.profiles pr WHERE pr.streak > (SELECT streak FROM mine)) AS streak_rank
  ),
  habit_rates AS (
    SELECT t.name,
           (count(tc.id)::numeric / 30 * 100)::int AS rate
    FROM public.tasks t
    LEFT JOIN public.task_completions tc
      ON tc.task_id = t.id AND tc.completed_on >= CURRENT_DATE - 29
    WHERE t.user_id = (SELECT uid FROM me) AND t.is_active
    GROUP BY t.name
  )
  SELECT
    (SELECT coins FROM mine),
    r.coin_rank,
    t.n,
    GREATEST(1, LEAST(99, (100 - (r.coin_rank::numeric / GREATEST(t.n,1) * 100))::int)),
    (SELECT streak FROM mine),
    r.streak_rank,
    (SELECT longest_streak FROM mine),
    LEAST(100, (
      SELECT COALESCE((count(DISTINCT tc.completed_on)::numeric / 30 * 100)::int, 0)
      FROM public.task_completions tc
      WHERE tc.user_id = (SELECT uid FROM me) AND tc.completed_on >= CURRENT_DATE - 29
    )),
    (SELECT count(*)::int FROM public.task_completions tc
      WHERE tc.user_id = (SELECT uid FROM me) AND tc.completed_on >= CURRENT_DATE - 29),
    (SELECT count(*)::int FROM public.tasks tk WHERE tk.user_id = (SELECT uid FROM me) AND tk.is_active),
    (SELECT name FROM habit_rates ORDER BY rate DESC, name LIMIT 1),
    (SELECT rate FROM habit_rates ORDER BY rate DESC, name LIMIT 1),
    (SELECT name FROM habit_rates ORDER BY rate ASC, name LIMIT 1),
    (SELECT rate FROM habit_rates ORDER BY rate ASC, name LIMIT 1)
  FROM ranks r, totals t
  WHERE public.has_premium_access(auth.uid());
$$;

REVOKE ALL ON FUNCTION public.rank_scan() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rank_scan() TO authenticated;