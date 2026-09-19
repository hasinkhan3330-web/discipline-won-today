
alter table public.goals
  add column if not exists category text,
  add column if not exists started_on date not null default current_date,
  add column if not exists target_coins integer not null default 0,
  add column if not exists earned_coins integer not null default 0,
  add column if not exists celebrated boolean not null default false,
  add column if not exists completed_at timestamptz;

create table if not exists public.goal_habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid not null references public.goals(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (goal_id, task_id)
);

create index if not exists goal_habits_user_idx on public.goal_habits(user_id);
create index if not exists goal_habits_task_idx on public.goal_habits(task_id);
create index if not exists goal_habits_goal_idx on public.goal_habits(goal_id);

grant select, insert, delete on public.goal_habits to authenticated;
grant all on public.goal_habits to service_role;
alter table public.goal_habits enable row level security;

drop policy if exists goal_habits_select_own on public.goal_habits;
drop policy if exists goal_habits_insert_own on public.goal_habits;
drop policy if exists goal_habits_delete_own on public.goal_habits;
create policy goal_habits_select_own on public.goal_habits for select to authenticated using (auth.uid() = user_id);
create policy goal_habits_insert_own on public.goal_habits for insert to authenticated with check (auth.uid() = user_id);
create policy goal_habits_delete_own on public.goal_habits for delete to authenticated using (auth.uid() = user_id);

create or replace function public.goal_scheduled_count(_frequency text, _from date, _to date)
returns integer language sql immutable set search_path = public as $$
  select case
    when _from is null or _to is null or _to < _from then 0
    when coalesce(_frequency, 'daily') = 'weekly' then ((_to - _from) / 7) + 1
    when _frequency = 'weekdays' then (select count(*) from generate_series(_from, _to, interval '1 day') d where extract(isodow from d) between 1 and 5)::int
    when _frequency = 'weekends' then (select count(*) from generate_series(_from, _to, interval '1 day') d where extract(isodow from d) >= 6)::int
    else (_to - _from) + 1
  end;
$$;

create or replace function public.recalc_goal(_goal_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  g public.goals%rowtype;
  _end date;
  _target integer := 0;
  _earned integer := 0;
  _pct integer;
begin
  select * into g from public.goals where id = _goal_id;
  if not found then return; end if;
  _end := coalesce(g.target_date, g.started_on + 20);

  select coalesce(sum(least(greatest(t.pts, 0), 50) * public.goal_scheduled_count(t.frequency, greatest(g.started_on, coalesce(t.started_on, g.started_on)), _end)), 0)
    into _target
    from public.goal_habits gh join public.tasks t on t.id = gh.task_id
   where gh.goal_id = g.id;

  select coalesce(sum(tc.coins_awarded), 0) into _earned
    from public.task_completions tc
   where tc.user_id = g.user_id
     and tc.task_id in (select task_id from public.goal_habits where goal_id = g.id)
     and tc.completed_on between g.started_on and _end;

  if _target > 0 then
    _pct := least(100, floor(_earned::numeric * 100 / _target)::int);
  else
    _pct := g.progress;
  end if;

  update public.goals
     set target_coins = _target,
         earned_coins = _earned,
         progress = greatest(case when _target > 0 then _pct else progress end, 0),
         completed = case when _target > 0 and _pct >= 100 then true else completed end,
         completed_at = case when _target > 0 and _pct >= 100 and completed_at is null then now() else completed_at end,
         updated_at = now()
   where id = g.id;
end $$;

revoke all on function public.recalc_goal(uuid) from public, anon;
grant execute on function public.recalc_goal(uuid) to authenticated, service_role;

create or replace function public.sync_goals_from_completion()
returns trigger language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in select distinct gh.goal_id from public.goal_habits gh where gh.task_id = coalesce(NEW.task_id, OLD.task_id) loop
    perform public.recalc_goal(r.goal_id);
  end loop;
  return null;
end $$;

drop trigger if exists trg_sync_goals_from_completion on public.task_completions;
create trigger trg_sync_goals_from_completion
after insert or update or delete on public.task_completions
for each row execute function public.sync_goals_from_completion();

create or replace function public.save_goal(_goal_id uuid, _title text, _category text, _target_date date, _task_ids uuid[])
returns uuid language plpgsql security definer set search_path = public as $$
declare
  _uid uuid := auth.uid();
  _id uuid;
  _t text := trim(coalesce(_title, ''));
  _cat text := nullif(left(trim(coalesce(_category, '')), 40), '');
begin
  if _uid is null then raise exception 'not authenticated'; end if;
  if length(_t) < 1 or length(_t) > 120 then raise exception 'goal title must be between 1 and 120 characters'; end if;
  if _target_date is not null and _target_date < current_date then raise exception 'target date must be today or later'; end if;

  if _goal_id is null then
    insert into public.goals(user_id, title, category, target_date, started_on)
    values (_uid, _t, _cat, _target_date, current_date)
    returning id into _id;
  else
    update public.goals set title = _t, category = _cat, target_date = _target_date, updated_at = now()
     where id = _goal_id and user_id = _uid
    returning id into _id;
    if _id is null then raise exception 'goal not found'; end if;
  end if;

  delete from public.goal_habits
   where goal_id = _id and user_id = _uid
     and not (task_id = any (coalesce(_task_ids, '{}'::uuid[])));

  insert into public.goal_habits(user_id, goal_id, task_id)
  select _uid, _id, t.id from public.tasks t
   where t.user_id = _uid and t.id = any (coalesce(_task_ids, '{}'::uuid[]))
  on conflict (goal_id, task_id) do nothing;

  perform public.recalc_goal(_id);
  return _id;
end $$;

revoke all on function public.save_goal(uuid, text, text, date, uuid[]) from public, anon;
grant execute on function public.save_goal(uuid, text, text, date, uuid[]) to authenticated, service_role;

create or replace function public.mark_goal_celebrated(_goal_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.goals set celebrated = true where id = _goal_id and user_id = auth.uid();
$$;

revoke all on function public.mark_goal_celebrated(uuid) from public, anon;
grant execute on function public.mark_goal_celebrated(uuid) to authenticated, service_role;

create or replace function public.goal_overview()
returns jsonb language plpgsql security definer stable set search_path = public as $$
declare
  _uid uuid := auth.uid();
  _streak integer := 0;
  _res jsonb;
begin
  if _uid is null then raise exception 'not authenticated'; end if;
  select coalesce(streak, 0) into _streak from public.profiles where id = _uid;

  with g as (select * from public.goals where user_id = _uid),
  bounds as (select g.id, least(current_date, coalesce(g.target_date, current_date)) as upto, greatest(1, (least(current_date, coalesce(g.target_date, current_date)) - g.started_on) + 1) as days from g),
  links as (
    select gh.goal_id, gh.task_id, t.name, t.icon, t.pts, t.frequency
      from public.goal_habits gh join public.tasks t on t.id = gh.task_id
     where gh.user_id = _uid
  ),
  expected as (
    select g.id,
      coalesce(sum(public.goal_scheduled_count(l.frequency, g.started_on, b.upto)), 0) as exp_all,
      coalesce(sum(public.goal_scheduled_count(l.frequency, greatest(g.started_on, current_date - 6), b.upto)), 0) as exp_7
      from g join bounds b on b.id = g.id left join links l on l.goal_id = g.id
     group by g.id
  ),
  done as (
    select g.id,
      count(tc.id) as done_all,
      count(distinct tc.completed_on) as active_days,
      count(tc.id) filter (where tc.completed_on >= current_date - 6) as done_7
      from g join bounds b on b.id = g.id
      left join links l on l.goal_id = g.id
      left join public.task_completions tc
        on tc.user_id = _uid and tc.task_id = l.task_id and tc.completed_on between g.started_on and b.upto
     group by g.id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', g.id,
    'title', g.title,
    'category', g.category,
    'target_date', g.target_date,
    'started_on', g.started_on,
    'progress', g.progress,
    'completed', g.completed,
    'celebrated', g.celebrated,
    'target_coins', g.target_coins,
    'earned_coins', g.earned_coins,
    'habits', (select coalesce(jsonb_agg(jsonb_build_object('id', l.task_id, 'name', l.name, 'icon', l.icon, 'pts', l.pts) order by l.name), '[]'::jsonb) from links l where l.goal_id = g.id),
    'readiness', round(
        50 * (case when e.exp_all > 0 then least(1, d.done_all::numeric / e.exp_all) else 0 end)
      + 20 * least(1, _streak::numeric / 21)
      + 20 * least(1, d.active_days::numeric / b.days)
      + 10 * (case when e.exp_7 > 0 then least(1, d.done_7::numeric / e.exp_7) else 0 end)
    )::int
  ) order by g.created_at desc), '[]'::jsonb)
  into _res
  from g join bounds b on b.id = g.id join expected e on e.id = g.id join done d on d.id = g.id;

  return _res;
end $$;

revoke all on function public.goal_overview() from public, anon;
grant execute on function public.goal_overview() to authenticated, service_role;
