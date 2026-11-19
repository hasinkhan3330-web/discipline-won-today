# Phase A: apply_daily_penalty row lock (proposal, nothing applied yet)

## 1. Current definition (LIVE, read today)
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
```

## 2. Proposed change (one line)
The function stays identical except for the first read, which gets `FOR UPDATE`:
```sql
  SELECT p.last_penalty_date, p.coins INTO _last_pen, _new_coins FROM public.profiles p WHERE p.id = _uid FOR UPDATE;
```
Applied as `CREATE OR REPLACE FUNCTION` with the full body above plus this one change. Name, arguments, return type, SECURITY DEFINER, search_path, UTC day, the −3 amount and the 'penalty' reason all stay the same. `CREATE OR REPLACE` keeps the existing execute permissions.

## 3. Why the penalty is taken only once
- `FOR UPDATE` locks that user's profile row until the call finishes.
- A second call at the same moment waits at that line. When it continues, it reads the already-updated `last_penalty_date` (= yesterday) and returns `penalized = false`.
- It also reads the fresh coin balance, so no stale `_new_coins` overwrites a newer balance. Today that overwrite risk exists too: a coin award landing between the read and the write could be lost. The lock removes it.
- The lock covers one user's row for a few milliseconds. Other users are not affected.

## 4. What stays the same
- No change to coin amounts, streak, tasks, task_completions, pacts (`daily_contracts`), Accountability, triggers (`guard_profile_economy_trg` still sees `app.economy_write`), UI, routes or any other function.
- Possible side effect: a coin award for the same user at the same instant waits a few milliseconds for the penalty to finish. Nothing fails.

## 5. Test plan (no test accounts, nothing kept)
- Before: save the current body with `select pg_get_functiondef('public.apply_daily_penalty'::regproc);` (already shown above).
- After applying: run `select pg_get_functiondef(...)` and check that only `FOR UPDATE` differs.
- Behaviour check inside `BEGIN … ROLLBACK`, on an existing user picked read-only with your OK, with `request.jwt.claims` set:
  - call 1 → expected `penalized = true`, coins −3 (if a task was missed yesterday);
  - call 2 → expected `penalized = false`, coins unchanged;
  - then ROLLBACK, so nothing is kept.
- Real two-session concurrency cannot be run from my SQL tool. It is NOT VERIFIED by a live test; the guarantee comes from Postgres row locking.
- Read-only check afterwards, which should return no new rows:
```sql
select user_id, created_at::date, count(*) from coin_transactions where reason='penalty' and created_at > now() - interval '2 days' group by 1,2 having count(*)>1;
```

## 6. Rollback SQL (restores today's exact version)
Run the full `CREATE OR REPLACE FUNCTION` from section 1 unchanged, i.e. without `FOR UPDATE`. It takes effect at once and needs no data change.

## Notes
- The database change is live straight away for preview and published (one shared database). No publish needed.
