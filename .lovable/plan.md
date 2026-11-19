# Phase A: apply_daily_penalty row lock (final proposal, not applied)

## Current state (LIVE, read today)
- Owner: `postgres`. Execute: `postgres`, `authenticated`, `service_role` (no anon/PUBLIC).
- SECURITY DEFINER: yes. search_path: `public`. Volatility: VOLATILE.

## 1. Exact migration SQL
Diff vs today: only `FOR UPDATE` added on the first SELECT.
```sql
CREATE OR REPLACE FUNCTION public.apply_daily_penalty()
 RETURNS TABLE(coins integer, penalized boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _yesterday date := ((now() AT TIME ZONE 'utc')::date) - 1;
  _last_pen date;
  _total int;
  _done int;
  _new_coins int;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  PERFORM set_config('app.economy_write', 'on', true);

  SELECT p.last_penalty_date, p.coins INTO _last_pen, _new_coins FROM public.profiles p WHERE p.id = _uid FOR UPDATE;
  IF _last_pen IS NOT NULL AND _last_pen >= _yesterday THEN
    coins := _new_coins; penalized := false; RETURN NEXT; RETURN;
  END IF;

  SELECT count(*) INTO _total FROM public.tasks t WHERE t.user_id = _uid AND t.is_active;
  IF _total = 0 THEN
    UPDATE public.profiles p SET last_penalty_date = _yesterday WHERE p.id = _uid;
    coins := _new_coins; penalized := false; RETURN NEXT; RETURN;
  END IF;

  SELECT count(*) INTO _done FROM public.task_completions tc WHERE tc.user_id = _uid AND tc.completed_on = _yesterday;

  IF _done < _total THEN
    _new_coins := GREATEST(0, _new_coins - 3);
    UPDATE public.profiles p SET coins = _new_coins, last_penalty_date = _yesterday WHERE p.id = _uid;
    INSERT INTO public.coin_transactions(user_id, amount, reason) VALUES (_uid, -3, 'penalty');
    coins := _new_coins; penalized := true; RETURN NEXT; RETURN;
  END IF;

  UPDATE public.profiles p SET last_penalty_date = _yesterday WHERE p.id = _uid;
  coins := _new_coins; penalized := false; RETURN NEXT;
END; $function$

-- Re-state current permissions (no-op if unchanged; CREATE OR REPLACE already keeps them)
REVOKE ALL ON FUNCTION public.apply_daily_penalty() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_daily_penalty() TO authenticated, service_role;
```

## 2. Exact rollback SQL (today's version, byte-for-byte body)
```sql
CREATE OR REPLACE FUNCTION public.apply_daily_penalty()
 RETURNS TABLE(coins integer, penalized boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _yesterday date := ((now() AT TIME ZONE 'utc')::date) - 1;
  _last_pen date;
  _total int;
  _done int;
  _new_coins int;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  PERFORM set_config('app.economy_write', 'on', true);

  SELECT p.last_penalty_date, p.coins INTO _last_pen, _new_coins FROM public.profiles p WHERE p.id = _uid;
  IF _last_pen IS NOT NULL AND _last_pen >= _yesterday THEN
    coins := _new_coins; penalized := false; RETURN NEXT; RETURN;
  END IF;

  SELECT count(*) INTO _total FROM public.tasks t WHERE t.user_id = _uid AND t.is_active;
  IF _total = 0 THEN
    UPDATE public.profiles p SET last_penalty_date = _yesterday WHERE p.id = _uid;
    coins := _new_coins; penalized := false; RETURN NEXT; RETURN;
  END IF;

  SELECT count(*) INTO _done FROM public.task_completions tc WHERE tc.user_id = _uid AND tc.completed_on = _yesterday;

  IF _done < _total THEN
    _new_coins := GREATEST(0, _new_coins - 3);
    UPDATE public.profiles p SET coins = _new_coins, last_penalty_date = _yesterday WHERE p.id = _uid;
    INSERT INTO public.coin_transactions(user_id, amount, reason) VALUES (_uid, -3, 'penalty');
    coins := _new_coins; penalized := true; RETURN NEXT; RETURN;
  END IF;

  UPDATE public.profiles p SET last_penalty_date = _yesterday WHERE p.id = _uid;
  coins := _new_coins; penalized := false; RETURN NEXT;
END; $function$

-- Re-state current permissions (no-op if unchanged; CREATE OR REPLACE already keeps them)
REVOKE ALL ON FUNCTION public.apply_daily_penalty() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_daily_penalty() TO authenticated, service_role;
```

## 3. What stays the same
- `CREATE OR REPLACE` with the same signature keeps owner `postgres`, the same function identity and its execute permissions; the GRANT/REVOKE lines only restate the current list.
- `SECURITY DEFINER` and `SET search_path TO 'public'` are written identically; the UTC day, −3 amount, 'penalty' reason and return type are unchanged.
- After applying, verify read-only:
```sql
select pg_get_userbyid(proowner), proacl, prosecdef, proconfig from pg_proc where oid='public.apply_daily_penalty'::regproc;
```
Expected: `postgres`, `{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}`, `true`, `{search_path=public}`.

## 4. Not modified
No UI, routes, screens, Accountability, pacts (`daily_contracts`), streak logic, triggers, tables or any other function. One migration file, one function.

## 5. Staging test (no writes to the live database)
There is no separate staging database: preview and live share one. The safe alternative:
- Start a throwaway local Postgres inside the build sandbox (no app connection, deleted afterwards).
- Create minimal copies of `profiles(id, coins, last_penalty_date)`, `tasks(user_id, is_active)`, `task_completions(user_id, completed_on)` and `coin_transactions(user_id, amount, reason)`, plus a stub `auth.uid()` that reads a session setting. Fake data only (one fake user, 10 coins, 1 active task, 0 completions yesterday).
- Load the OLD function, then open two sessions that call it at the same time (session 1 holds its transaction briefly). Expected old result: −6 total and 2 'penalty' rows (proves the bug).
- Load the NEW function and repeat. Expected: session 2 waits, then returns `penalized=false`; total −3, one 'penalty' row, final coins 7.
- Also expected: a second call on the same day → `penalized=false`; a user with 0 tasks → no deduction; all tasks done → no deduction.
- Live database: only the read-only owner/permission check above and the duplicate-penalty SELECT below.
```sql
select user_id, created_at::date, count(*) from coin_transactions where reason='penalty' and created_at > now() - interval '2 days' group by 1,2 having count(*)>1;
```

## Notes
The change takes effect at once on preview and the published app (one shared database); no publish is needed. Rollback is instant by running section 2.
