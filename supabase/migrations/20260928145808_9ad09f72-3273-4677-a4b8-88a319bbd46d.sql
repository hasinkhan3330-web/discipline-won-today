ALTER TABLE public.goals ADD COLUMN IF NOT EXISTS plan_duration text NOT NULL DEFAULT '1_year';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='goals_plan_duration_check') THEN
    ALTER TABLE public.goals ADD CONSTRAINT goals_plan_duration_check CHECK (plan_duration IN ('1_year','6_month','3_month'));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.guard_goal_coins()
RETURNS trigger LANGUAGE plpgsql SET search_path TO '' AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN NEW.plan_duration := OLD.plan_duration; END IF;
  IF coalesce(current_setting('axen.goal_write', true),'') <> 'on' THEN
    IF TG_OP = 'INSERT' THEN
      NEW.earned_coins := 0;
      NEW.target_coins := CASE NEW.plan_duration WHEN '3_month' THEN 4500 WHEN '6_month' THEN 9000 ELSE 18000 END;
    ELSE NEW.earned_coins := OLD.earned_coins; NEW.target_coins := OLD.target_coins; END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.recalc_goal(_goal_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare g public.goals%rowtype; _earned integer := 0; _target integer; _pct integer;
begin
  select * into g from public.goals where id = _goal_id;
  if not found then return; end if;
  if auth.uid() is not null and auth.uid() <> g.user_id then return; end if;
  _target := case g.plan_duration when '3_month' then 4500 when '6_month' then 9000 else 18000 end;
  select coalesce(sum(tc.coins_awarded), 0) into _earned
    from public.task_completions tc
   where tc.user_id = g.user_id
     and tc.task_id in (select task_id from public.goal_habits where goal_id = g.id)
     and tc.completed_on >= g.started_on;
  _earned := greatest(coalesce(g.earned_coins,0), _earned);
  _pct := least(100, floor(_earned::numeric * 100 / _target)::int);
  perform set_config('axen.goal_write','on',true);
  update public.goals
     set target_coins = _target, earned_coins = _earned,
         progress = case when completed then progress else _pct end,
         completed = case when _earned >= _target then true else completed end,
         completed_at = case when _earned >= _target and completed_at is null then now() else completed_at end,
         updated_at = now()
   where id = g.id;
end $function$;

DROP FUNCTION IF EXISTS public.save_goal(uuid, text, text, date, uuid[]);
CREATE OR REPLACE FUNCTION public.save_goal(_goal_id uuid, _title text, _category text, _target_date date, _task_ids uuid[], _plan_duration text DEFAULT '1_year')
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare
  _uid uuid := auth.uid();
  _id uuid;
  _t text := trim(coalesce(_title, ''));
  _cat text := nullif(left(trim(coalesce(_category, '')), 40), '');
  _plan text := coalesce(_plan_duration, '1_year');
begin
  if _uid is null then raise exception 'not authenticated'; end if;
  if _plan not in ('1_year','6_month','3_month') then raise exception 'invalid plan'; end if;
  if length(_t) < 1 or length(_t) > 120 then raise exception 'goal title must be between 1 and 120 characters'; end if;
  if _target_date is not null and _target_date < current_date then raise exception 'target date must be today or later'; end if;
  if _goal_id is null then
    insert into public.goals(user_id, title, category, target_date, started_on, plan_duration)
    values (_uid, _t, _cat, _target_date, current_date, _plan) returning id into _id;
  else
    update public.goals set title = _t, category = _cat, target_date = _target_date, updated_at = now()
     where id = _goal_id and user_id = _uid returning id into _id;
    if _id is null then raise exception 'goal not found'; end if;
  end if;
  delete from public.goal_habits where goal_id = _id and user_id = _uid
     and not (task_id = any (coalesce(_task_ids, '{}'::uuid[])));
  insert into public.goal_habits(user_id, goal_id, task_id)
  select _uid, _id, t.id from public.tasks t
   where t.user_id = _uid and t.id = any (coalesce(_task_ids, '{}'::uuid[]))
  on conflict (goal_id, task_id) do nothing;
  perform public.recalc_goal(_id);
  return _id;
end $function$;
REVOKE ALL ON FUNCTION public.save_goal(uuid, text, text, date, uuid[], text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_goal(uuid, text, text, date, uuid[], text) TO authenticated;