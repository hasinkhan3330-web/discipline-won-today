# Phase 1 — Database Foundation: COMPLETE SQL for review (NOTHING APPLIED)

Nothing has been created, changed, or applied. This document is the complete, exact Phase 1 migration — every table, index, grant, policy, trigger, function, plus the RLS matrix, security proofs, and test suite. It runs only after your explicit approval.

## 0. Compatibility checks already run against your live schema

- `profiles` exists (id, coins, streak, shields, trial/subscription columns). Reused, not modified.
- `goals` exists (id, user_id, title, category, target_date, target_coins, earned_coins). Contracts link optionally, on delete set null.
- `score_events` columns confirmed: id, user_id, points, kind, idempotency_key, occurred_at, created_at — and `score_events_idempotency_key_key` UNIQUE index confirmed via pg_indexes. Verified XP reuses this table; no second ledger.
- **Privilege check confirmed: `score_events`, `coin_transactions`, and `profiles` currently have ZERO grants to `anon`/`authenticated`** (information_schema.table_privileges returns empty). Users cannot touch reward tables directly at all today. Phase 1 adds no grants to them either.
- `coin_transactions` exists (id, user_id, amount, reason, ref_id, created_at). Contract coins reuse it.
- No `daily_contracts`, `contract_sessions`, `proof_submissions`, `recovery_events`, `accountability_*`, or `contract_events` table exists today — every CREATE is purely new.
- The existing `protect_verified_reward_fields` pattern (server-only `app.economy_write` flag) is extended to the new reward-bearing tables.

---

## 1. Complete migration SQL

```sql
-- ============ SECTION 1: extension, type, additive column ============
create extension if not exists pgcrypto;  -- sha256 for hashed invite tokens

create type public.contract_status as enum (
  'draft','scheduled','active','interrupted','proof_pending',
  'verified','needs_review','retry_requested','rejected',
  'completed','rewarded','rescheduled','missed',
  'recovery_available','recovered','cancelled'
);

-- additive XP ledger metadata (nullable; no existing row is rewritten)
alter table public.score_events add column if not exists metadata jsonb;

-- ============ SECTION 2: shared trigger functions ============

-- generic updated_at toucher (plain function; runs as invoker)
create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- contract reward/status guard: client UPDATEs cannot change reward columns
-- or enter server-only statuses unless the server set the economy_write flag
create or replace function public.guard_contract_fields() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  srv boolean := coalesce(current_setting('app.economy_write', true), 'off') = 'on';
begin
  if tg_op = 'UPDATE' and not srv then
    if new.xp_awarded    is distinct from old.xp_awarded
       or new.coins_awarded is distinct from old.coins_awarded
       or new.rewarded_at   is distinct from old.rewarded_at
       or (new.status is distinct from old.status and new.status in (
            'verified','needs_review','retry_requested','rejected',
            'completed','rewarded','recovered','recovery_available'))
    then
      raise exception 'reward fields can only be set by the server';
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;

-- proof guard: clients can only insert pending submissions; never change
-- status/confidence/verifier fields (defense in depth; users get no UPDATE grant)
create or replace function public.guard_proof_submission_fields() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  srv boolean := coalesce(current_setting('app.economy_write', true), 'off') = 'on';
begin
  if srv then return new; end if;
  if tg_op = 'INSERT' then
    if new.status <> 'pending' or new.confidence is not null
       or new.verified_at is not null or new.reviewed_at is not null
       or new.verifier_version is not null or new.retry_count <> 0
    then raise exception 'verification fields can only be set by the server'; end if;
  else
    raise exception 'proof verification status can only be changed by the server';
  end if;
  return new;
end $$;

-- recovery guard: both linked contracts must belong to the same user
create or replace function public.guard_recovery_owner() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.daily_contracts o
                 where o.id = new.original_contract_id and o.user_id = new.user_id)
     or not exists (select 1 from public.daily_contracts r
                 where r.id = new.recovery_contract_id and r.user_id = new.user_id)
  then raise exception 'recovery must link two contracts of the same user'; end if;
  return new;
end $$;

-- session guard: a session may only attach to the owner's own contract
create or replace function public.guard_session_contract_owner() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.daily_contracts c
                 where c.id = new.contract_id and c.user_id = new.user_id)
  then raise exception 'session must belong to the contract owner'; end if;
  return new;
end $$;

-- contract event guard: event must reference the writer's own contract
create or replace function public.guard_contract_event_owner() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.daily_contracts c
                 where c.id = new.contract_id and c.user_id = new.user_id)
  then raise exception 'event must reference the user''s own contract'; end if;
  return new;
end $$;

-- accountability event guard: sender must be a party; contract must belong
-- to one of the two parties of the connection
create or replace function public.guard_accountability_event() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  party boolean;
begin
  select (new.sender_user_id = c.owner_user_id or new.sender_user_id = c.partner_user_id)
    into party
    from public.accountability_connections c where c.id = new.connection_id;
  if party is distinct from true then
    raise exception 'sender must be a party of the connection';
  end if;
  if new.contract_id is not null and not exists (
      select 1 from public.daily_contracts dc
      join public.accountability_connections c on c.id = new.connection_id
      where dc.id = new.contract_id
        and dc.user_id in (c.owner_user_id, c.partner_user_id))
  then raise exception 'event contract must belong to a connection party'; end if;
  return new;
end $$;

-- ============ SECTION 3: daily_contracts ============
create table public.daily_contracts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid references public.goals(id) on delete set null,
  title text not null check (char_length(title) between 3 and 120),
  category text not null check (category in
    ('study','work','exercise','walking','meditation','wake-up','reading','custom')),
  scheduled_at timestamptz not null,
  timezone text not null,
  local_day date not null,
  planned_duration_seconds int not null
    check (planned_duration_seconds between 300 and 21600),
  rescue_duration_seconds int not null check (rescue_duration_seconds >= 60),
  trigger_text text,
  proof_method text not null check (proof_method in
    ('timer_recall','zen_session','step_counter','manual_note',
     'qr_mission','photo_optional','timer_checklist','partner_confirm','photo')),
  status public.contract_status not null default 'draft',
  difficulty text not null default 'normal' check (difficulty in ('easy','normal','hard')),
  accountability_enabled boolean not null default false,
  private_note text,
  reminder_pref jsonb not null default '{"prep_minutes":5,"start":true,"missed_followup":true}'::jsonb,
  is_recovery boolean not null default false,
  recovery_of_id uuid references public.daily_contracts(id) on delete set null,
  version int not null default 1,
  started_at timestamptz,
  completed_at timestamptz,
  expires_at timestamptz,
  rewarded_at timestamptz,
  xp_awarded int not null default 0,
  coins_awarded int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (rescue_duration_seconds <= planned_duration_seconds)
);

-- one active primary contract per user per local day
create unique index daily_contracts_one_primary_per_day
  on public.daily_contracts (user_id, local_day)
  where is_recovery = false and status not in ('missed','cancelled','rejected');
create index daily_contracts_user_sched  on public.daily_contracts (user_id, scheduled_at);
create index daily_contracts_user_status on public.daily_contracts (user_id, status);
create index daily_contracts_goal_idx    on public.daily_contracts (goal_id);

grant select, insert, update on public.daily_contracts to authenticated;
grant all on public.daily_contracts to service_role;
-- (no grant to anon: anon is denied before RLS is even consulted)
alter table public.daily_contracts enable row level security;

create policy dc_select on public.daily_contracts for select to authenticated
  using (user_id = auth.uid());
create policy dc_insert on public.daily_contracts for insert to authenticated
  with check (user_id = auth.uid()
    and status in ('draft','scheduled')
    and xp_awarded = 0 and coins_awarded = 0 and rewarded_at is null
    and completed_at is null and started_at is null
    and is_recovery = false and recovery_of_id is null);
create policy dc_update on public.daily_contracts for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
-- no DELETE policy + no DELETE grant: reward history can never be erased

create trigger trg_guard_contract
  before insert or update on public.daily_contracts
  for each row execute function public.guard_contract_fields();

-- ============ SECTION 4: contract_sessions ============
create table public.contract_sessions (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.daily_contracts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  started_at timestamptz not null default now(),
  expected_end_at timestamptz not null,
  ended_at timestamptz,
  elapsed_seconds int not null default 0 check (elapsed_seconds >= 0),
  pause_seconds int not null default 0 check (pause_seconds >= 0),
  exit_reason text,
  session_status text not null default 'active'
    check (session_status in ('active','ended','abandoned')),
  client_instance_id uuid,
  checkpoint_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- prevents duplicate active sessions under a race (second insert violates)
create unique index contract_sessions_one_active
  on public.contract_sessions (contract_id) where session_status = 'active';
create index contract_sessions_user_idx  on public.contract_sessions (user_id, contract_id);

grant select, insert, update on public.contract_sessions to authenticated;
grant all on public.contract_sessions to service_role;
alter table public.contract_sessions enable row level security;

create policy cs_select on public.contract_sessions for select to authenticated
  using (user_id = auth.uid());
create policy cs_insert on public.contract_sessions for insert to authenticated
  with check (user_id = auth.uid() and session_status = 'active'
    and ended_at is null and elapsed_seconds = 0);
create policy cs_update on public.contract_sessions for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy cs_delete on public.contract_sessions for delete to authenticated
  using (user_id = auth.uid() and session_status <> 'active');

create trigger trg_session_owner
  before insert or update on public.contract_sessions
  for each row execute function public.guard_session_contract_owner();
create trigger trg_touch_contract_sessions
  before update on public.contract_sessions
  for each row execute function public.touch_updated_at();

-- ============ SECTION 5: proof_submissions ============
create table public.proof_submissions (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.daily_contracts(id) on delete cascade,
  session_id uuid references public.contract_sessions(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  proof_type text not null check (proof_type in
    ('timer_recall','zen_session','step_counter','manual_note',
     'qr_mission','photo','timer_checklist','partner_confirm')),
  private_storage_path text,
  text_evidence text,
  status text not null default 'pending' check (status in
    ('pending','verified','needs_review','retry_requested','rejected','unavailable')),
  confidence numeric(4,3),
  reason_code text,
  safe_user_message text,
  verifier_version text,
  retry_count int not null default 0,
  submitted_at timestamptz not null default now(),
  verified_at timestamptz,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index proof_submissions_contract_idx on public.proof_submissions (contract_id);
create index proof_submissions_status_idx   on public.proof_submissions (status, submitted_at);

-- users get SELECT + INSERT only. No UPDATE grant and no UPDATE policy exist,
-- so a client UPDATE is rejected with a permission error before any trigger.
grant select, insert on public.proof_submissions to authenticated;
grant all on public.proof_submissions to service_role;
alter table public.proof_submissions enable row level security;

create policy ps_select on public.proof_submissions for select to authenticated
  using (user_id = auth.uid());
create policy ps_insert on public.proof_submissions for insert to authenticated
  with check (user_id = auth.uid() and status = 'pending'
    and confidence is null and verified_at is null
    and reviewed_at is null and verifier_version is null and retry_count = 0);
-- (intentionally NO update policy and NO delete policy)

create trigger trg_guard_proof
  before insert or update on public.proof_submissions
  for each row execute function public.guard_proof_submission_fields();
create trigger trg_touch_proof_submissions
  before update on public.proof_submissions
  for each row execute function public.touch_updated_at();

-- ============ SECTION 6: recovery_events ============
create table public.recovery_events (
  id uuid primary key default gen_random_uuid(),
  original_contract_id uuid not null unique
    references public.daily_contracts(id) on delete cascade,
  recovery_contract_id uuid not null
    references public.daily_contracts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reason text check (reason in
    ('time_conflict','task_too_large','low_energy','forgot','distraction','other')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- `unique` above = maximum one recovery per original contract

create index recovery_events_user_idx on public.recovery_events (user_id);

-- users get SELECT only; rows are created by the server RPC
grant select on public.recovery_events to authenticated;
grant all on public.recovery_events to service_role;
alter table public.recovery_events enable row level security;

create policy re_select on public.recovery_events for select to authenticated
  using (user_id = auth.uid());
-- (no insert/update/delete policy or grant for users)

create trigger trg_recovery_owner
  before insert or update on public.recovery_events
  for each row execute function public.guard_recovery_owner();
create trigger trg_touch_recovery_events
  before update on public.recovery_events
  for each row execute function public.touch_updated_at();

-- ============ SECTION 7: accountability_connections ============
create table public.accountability_connections (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  partner_user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending','active','revoked','blocked')),
  sharing_preferences jsonb not null
    default '{"share_status":true,"share_proof":false}'::jsonb,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  revoked_at timestamptz,
  updated_at timestamptz not null default now(),
  check (owner_user_id <> partner_user_id),
  unique (owner_user_id, partner_user_id)
);

-- max ONE active partner per owner AND per partner (no partner stacking)
create unique index one_active_partner_owner
  on public.accountability_connections (owner_user_id) where status = 'active';
create unique index one_active_partner_partner
  on public.accountability_connections (partner_user_id) where status = 'active';
create index accountability_connections_partner_idx
  on public.accountability_connections (partner_user_id);

-- users may read connections they participate in and create pending invites.
-- NO update grant: every status transition (accept/revoke/block) goes through
-- the server RPCs, so nobody can self-activate a partnership.
grant select, insert on public.accountability_connections to authenticated;
grant all on public.accountability_connections to service_role;
alter table public.accountability_connections enable row level security;

create policy ac_select on public.accountability_connections for select to authenticated
  using (owner_user_id = auth.uid() or partner_user_id = auth.uid());
create policy ac_insert on public.accountability_connections for insert to authenticated
  with check (owner_user_id = auth.uid() and status = 'pending'
    and accepted_at is null and revoked_at is null);
-- (no update/delete policy or grant for users)

create trigger trg_touch_accountability_connections
  before update on public.accountability_connections
  for each row execute function public.touch_updated_at();

-- ============ SECTION 8: accountability_invites ============
create table public.accountability_invites (
  id uuid primary key default gen_random_uuid(),
  inviter_user_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique,          -- sha256; plaintext token never stored
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- database-level bar on self-acceptance (belt) — RPC also checks (braces)
  check (accepted_by is null or accepted_by <> inviter_user_id)
);

create index accountability_invites_inviter_idx on public.accountability_invites (inviter_user_id, created_at);

-- users may list only their own invites; creation/acceptance via RPC only
grant select on public.accountability_invites to authenticated;
grant all on public.accountability_invites to service_role;
alter table public.accountability_invites enable row level security;

create policy ai_select on public.accountability_invites for select to authenticated
  using (inviter_user_id = auth.uid());
-- (no insert/update/delete policy or grant for users)

create trigger trg_touch_accountability_invites
  before update on public.accountability_invites
  for each row execute function public.touch_updated_at();

-- ============ SECTION 9: accountability_events ============
create table public.accountability_events (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null
    references public.accountability_connections(id) on delete cascade,
  contract_id uuid references public.daily_contracts(id) on delete set null,
  sender_user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (event_type in
    ('nudge','started','completed','recovered','rescheduled')),
  message text check (char_length(message) <= 140),
  created_at timestamptz not null default now()
);

create index accountability_events_connection_idx
  on public.accountability_events (connection_id, created_at);

grant select, insert on public.accountability_events to authenticated;
grant all on public.accountability_events to service_role;
alter table public.accountability_events enable row level security;

-- SELECT: only a party of a pending/active connection sees its events.
-- When the connection is revoked/blocked, BOTH parties lose event access
-- immediately (the subquery checks status).
create policy ae_select on public.accountability_events for select to authenticated
  using (exists (
    select 1 from public.accountability_connections c
    where c.id = connection_id
      and c.status in ('pending','active')
      and (c.owner_user_id = auth.uid() or c.partner_user_id = auth.uid())));
create policy ae_insert on public.accountability_events for insert to authenticated
  with check (sender_user_id = auth.uid() and exists (
    select 1 from public.accountability_connections c
    where c.id = connection_id and c.status = 'active'
      and (c.owner_user_id = auth.uid() or c.partner_user_id = auth.uid())));
-- (no update/delete policy or grant for users)

create trigger trg_guard_accountability_event
  before insert or update on public.accountability_events
  for each row execute function public.guard_accountability_event();

-- ============ SECTION 10: contract_events (append-only audit) ============
create table public.contract_events (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.daily_contracts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  event_version int not null default 1,
  event_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index contract_events_contract_idx on public.contract_events (contract_id, created_at);

-- append-only: SELECT + INSERT for the owner; no update/delete ever
grant select, insert on public.contract_events to authenticated;
grant all on public.contract_events to service_role;
alter table public.contract_events enable row level security;

create policy ce_select on public.contract_events for select to authenticated
  using (user_id = auth.uid());
create policy ce_insert on public.contract_events for insert to authenticated
  with check (user_id = auth.uid());

create trigger trg_guard_contract_event
  before insert or update on public.contract_events
  for each row execute function public.guard_contract_event_owner();
```

### 1b. SECURITY DEFINER functions (server-side only)

```sql
-- ============ SECTION 11: server-side verification + reward ============

-- Called by the server's verification pipeline (service_role only).
-- Persists the structured AI/deterministic decision and transitions the contract.
create or replace function public.verify_contract_proof(
  p_submission_id uuid,
  p_decision text,
  p_confidence numeric,
  p_reason_code text,
  p_safe_message text,
  p_verifier text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_sub public.proof_submissions%rowtype;
begin
  if coalesce(current_setting('app.economy_write', true), 'off') <> 'on' then
    raise exception 'server-only operation';
  end if;
  if p_decision not in ('verified','needs_review','retry_requested','rejected','unavailable') then
    raise exception 'invalid decision';
  end if;
  select * into v_sub from public.proof_submissions where id = p_submission_id;
  if not found then raise exception 'submission not found'; end if;
  if v_sub.status <> 'pending' then
    return jsonb_build_object('status', v_sub.status, 'idempotent', true);
  end if;
  update public.proof_submissions
     set status = p_decision, confidence = p_confidence,
         reason_code = p_reason_code, safe_user_message = p_safe_message,
         verifier_version = p_verifier, verified_at = now()
   where id = p_submission_id;
  update public.daily_contracts
     set status = case p_decision
           when 'verified'        then 'verified'::public.contract_status
           when 'needs_review'    then 'needs_review'::public.contract_status
           when 'retry_requested' then 'retry_requested'::public.contract_status
           when 'rejected'        then 'rejected'::public.contract_status
           else 'proof_pending'::public.contract_status end
   where id = v_sub.contract_id;
  return jsonb_build_object('status', p_decision, 'contract_id', v_sub.contract_id);
end $$;

-- THE single reward transaction. Service_role only. Idempotent + race-safe
-- (row lock on the contract serialises concurrent calls; ledger insert is
-- protected by the existing score_events.idempotency_key UNIQUE index).
create or replace function public.award_contract(
  p_contract_id uuid,
  p_idempotency_key text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_c public.daily_contracts%rowtype;
  v_base_seconds int;
  v_xp int;
  v_coins int;
  v_key text;
  v_kind text;
begin
  if coalesce(current_setting('app.economy_write', true), 'off') <> 'on' then
    raise exception 'server-only operation';
  end if;
  select * into v_c from public.daily_contracts where id = p_contract_id for update;
  if not found then raise exception 'contract not found'; end if;
  if v_c.status = 'rewarded' then
    return jsonb_build_object('rewarded', true, 'idempotent', true,
      'xp', v_c.xp_awarded, 'coins', v_c.coins_awarded);
  end if;
  if v_c.status not in ('verified','recovered') then
    raise exception 'contract is not verified for reward';
  end if;
  -- server-controlled XP: base = clamp(round(planned_minutes/5)*2, 5, 60)
  -- difficulty multiplier; recovery = ceil(full * 0.3) measured against the
  -- ORIGINAL duration (never the shortened rescue duration)
  if v_c.is_recovery and v_c.recovery_of_id is not null then
    select planned_duration_seconds into v_base_seconds
      from public.daily_contracts where id = v_c.recovery_of_id;
    v_xp := least(60, greatest(5, (v_base_seconds / 300) * 2));
    if v_c.difficulty = 'hard' then v_xp := round(v_xp * 1.3)::int;
    elsif v_c.difficulty = 'normal' then v_xp := round(v_xp * 1.15)::int; end if;
    v_xp := ceil(v_xp * 0.3)::int;
    v_kind := 'contract_recovery';
  else
    v_xp := least(60, greatest(5, (v_c.planned_duration_seconds / 300) * 2));
    if v_c.difficulty = 'hard' then v_xp := round(v_xp * 1.3)::int;
    elsif v_c.difficulty = 'normal' then v_xp := round(v_xp * 1.15)::int; end if;
    v_kind := 'contract_verified';
  end if;
  v_coins := least(30, ceil(v_xp / 2.0)::int);
  v_key := coalesce(p_idempotency_key, v_kind || ':' || p_contract_id::text);

  insert into public.score_events (user_id, points, kind, idempotency_key, metadata)
  values (v_c.user_id, v_xp, v_kind, v_key,
          jsonb_build_object('contract_id', p_contract_id, 'source', v_kind))
  on conflict (idempotency_key) do nothing;

  insert into public.coin_transactions (user_id, amount, reason, ref_id)
  values (v_c.user_id, v_coins, v_kind, p_contract_id);

  update public.profiles set coins = coins + v_coins, updated_at = now()
   where id = v_c.user_id;

  update public.daily_contracts
     set status = 'rewarded', rewarded_at = now(),
         xp_awarded = v_xp, coins_awarded = v_coins,
         completed_at = coalesce(completed_at, now())
   where id = p_contract_id;

  if v_c.is_recovery and v_c.recovery_of_id is not null then
    update public.daily_contracts set status = 'recovered'
     where id = v_c.recovery_of_id and status = 'recovery_available';
  end if;

  return jsonb_build_object('rewarded', true, 'xp', v_xp, 'coins', v_coins);
end $$;

-- ============ SECTION 12: user-facing contract RPCs (authenticated only) ============

create or replace function public.start_contract_session(
  p_contract_id uuid, p_client_instance uuid, p_expected_end_at timestamptz
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_sid uuid;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from public.daily_contracts
                 where id = p_contract_id and user_id = v_uid
                   and status in ('scheduled','rescheduled')) then
    raise exception 'contract is not startable';
  end if;
  insert into public.contract_sessions (contract_id, user_id, expected_end_at, client_instance_id)
  values (p_contract_id, v_uid, p_expected_end_at, p_client_instance)
  returning id into v_sid;
  update public.daily_contracts
     set status = 'active', started_at = coalesce(started_at, now())
   where id = p_contract_id;
  return v_sid;
end $$;

create or replace function public.checkpoint_contract_session(
  p_session_id uuid, p_elapsed_seconds int, p_pause_seconds int
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  update public.contract_sessions
     set elapsed_seconds = greatest(elapsed_seconds, p_elapsed_seconds),
         pause_seconds  = greatest(pause_seconds,  p_pause_seconds),
         checkpoint_at  = now()
   where id = p_session_id and user_id = auth.uid() and session_status = 'active';
  if not found then raise exception 'active session not found'; end if;
end $$;

create or replace function public.end_contract_session(
  p_session_id uuid, p_exit_reason text, p_outcome text,
  p_elapsed_seconds int, p_pause_seconds int
) returns text
language plpgsql security definer set search_path = public as $$
declare v_contract uuid; v_status text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_outcome not in ('completed','ended','abandoned') then
    raise exception 'invalid outcome';
  end if;
  select contract_id into v_contract from public.contract_sessions
   where id = p_session_id and user_id = auth.uid() and session_status = 'active';
  if not found then raise exception 'active session not found'; end if;
  update public.contract_sessions
     set ended_at = now(), exit_reason = p_exit_reason,
         elapsed_seconds = greatest(elapsed_seconds, p_elapsed_seconds),
         pause_seconds   = greatest(pause_seconds,  p_pause_seconds),
         session_status  = case p_outcome when 'completed' then 'ended' else p_outcome end
   where id = p_session_id;
  v_status := case p_outcome
    when 'completed' then 'proof_pending'
    when 'abandoned' then 'missed'
    else 'interrupted' end;
  update public.daily_contracts
     set status = v_status::public.contract_status,
         completed_at = case when p_outcome = 'completed' then now() else completed_at end
   where id = v_contract;
  return v_status;
end $$;
-- note: 'completed' on the SESSION still requires server-side proof
-- verification before any reward — claiming completion awards nothing.

create or replace function public.submit_contract_proof(
  p_contract_id uuid, p_session_id uuid, p_proof_type text,
  p_text_evidence text, p_storage_path text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_sid uuid;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from public.daily_contracts
                 where id = p_contract_id and user_id = v_uid
                   and status in ('active','proof_pending','interrupted')) then
    raise exception 'contract is not accepting proof';
  end if;
  if (select count(*) from public.proof_submissions
      where contract_id = p_contract_id) >= 5 then
    raise exception 'proof submission limit reached';
  end if;
  if p_storage_path is not null
     and p_storage_path not like ('contract-proofs/' || v_uid::text || '/%') then
    raise exception 'invalid storage path';
  end if;
  insert into public.proof_submissions
    (contract_id, session_id, user_id, proof_type, private_storage_path, text_evidence)
  values (p_contract_id, p_session_id, v_uid, p_proof_type, p_storage_path, p_text_evidence)
  returning id into v_sid;
  update public.daily_contracts set status = 'proof_pending'
   where id = p_contract_id and status in ('active','interrupted');
  return v_sid;
end $$;

create or replace function public.start_recovery_contract(
  p_original_id uuid, p_reason text, p_scheduled_at timestamptz, p_timezone text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_orig record; v_new uuid; v_expires timestamptz;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  select * into v_orig from public.daily_contracts
   where id = p_original_id and user_id = v_uid for update;
  if not found then raise exception 'contract not found'; end if;
  if v_orig.is_recovery then raise exception 'cannot recover a recovery contract'; end if;
  if v_orig.status not in ('missed','recovery_available') then
    raise exception 'contract is not recoverable';
  end if;
  if exists (select 1 from public.recovery_events
             where original_contract_id = p_original_id) then
    raise exception 'recovery already used for this contract';
  end if;
  -- rescue expires at the END of the user's local day (timezone-aware)
  v_expires := (date_trunc('day', (p_scheduled_at at time zone p_timezone))
                + interval '1 day') at time zone p_timezone;
  insert into public.daily_contracts
    (user_id, goal_id, title, category, scheduled_at, timezone, local_day,
     planned_duration_seconds, rescue_duration_seconds, proof_method, status,
     difficulty, is_recovery, recovery_of_id, expires_at)
  values
    (v_uid, v_orig.goal_id, v_orig.title, v_orig.category, p_scheduled_at, p_timezone,
     (p_scheduled_at at time zone p_timezone)::date,
     greatest(60, round(v_orig.planned_duration_seconds * 0.2)::int),
     greatest(60, round(v_orig.planned_duration_seconds * 0.2)::int),
     v_orig.proof_method, 'scheduled', v_orig.difficulty, true, p_original_id, v_expires)
  returning id into v_new;
  insert into public.recovery_events (original_contract_id, recovery_contract_id, user_id, reason)
  values (p_original_id, v_new, v_uid, p_reason);
  update public.daily_contracts set status = 'recovery_available'
   where id = p_original_id;
  return v_new;
end $$;

create or replace function public.reschedule_contract(
  p_contract_id uuid, p_new_at timestamptz, p_timezone text
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  update public.daily_contracts
     set scheduled_at = p_new_at, timezone = p_timezone,
         local_day = (p_new_at at time zone p_timezone)::date,
         status = 'rescheduled'
   where id = p_contract_id and user_id = auth.uid()
     and status in ('scheduled','rescheduled');
  if not found then raise exception 'contract is not reschedulable'; end if;
end $$;
-- rescheduling into a day that already has a primary contract raises the
-- unique-index violation — one contract per local day is preserved.

-- ============ SECTION 13: accountability RPCs (authenticated only) ============

create or replace function public.create_accountability_invite() returns text
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_token text;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if (select count(*) from public.accountability_invites
      where inviter_user_id = v_uid
        and created_at > now() - interval '1 day') >= 5 then
    raise exception 'invite limit reached for today';
  end if;
  v_token := encode(gen_random_bytes(16), 'hex');
  insert into public.accountability_invites (inviter_user_id, token_hash, expires_at)
  values (v_uid, encode(digest(v_token, 'sha256'), 'hex'), now() + interval '7 days');
  return v_token;  -- plaintext returned ONCE, only the sha256 hash is stored
end $$;

create or replace function public.accept_accountability_invite(p_token text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_inv record; v_conn uuid;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  select * into v_inv from public.accountability_invites
   where token_hash = encode(digest(p_token, 'sha256'), 'hex') for update;
  if not found then raise exception 'invalid invite'; end if;
  if v_inv.revoked_at is not null then raise exception 'invite revoked'; end if;
  if v_inv.accepted_at is not null then raise exception 'invite already used'; end if;
  if v_inv.expires_at < now() then raise exception 'invite expired'; end if;
  if v_inv.inviter_user_id = v_uid then raise exception 'cannot accept your own invite'; end if;
  if exists (select 1 from public.accountability_connections
             where ((owner_user_id = v_uid and partner_user_id = v_inv.inviter_user_id)
                 or (owner_user_id = v_inv.inviter_user_id and partner_user_id = v_uid))
               and status = 'active') then
    raise exception 'each user can have only one active partner';
  end if;
  insert into public.accountability_connections
    (owner_user_id, partner_user_id, status, accepted_at)
  values (v_inv.inviter_user_id, v_uid, 'active', now())
  returning id into v_conn;
  update public.accountability_invites set accepted_at = now(), accepted_by = v_uid
   where id = v_inv.id;
  return v_conn;
end $$;

create or replace function public.revoke_accountability(p_connection_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  update public.accountability_connections
     set status = 'revoked', revoked_at = now(), updated_at = now()
   where id = p_connection_id and status = 'active'
     and auth.uid() in (owner_user_id, partner_user_id);
  if not found then raise exception 'connection not found'; end if;
end $$;

create or replace function public.block_accountability(p_connection_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  update public.accountability_connections
     set status = 'blocked', revoked_at = now(), updated_at = now()
   where id = p_connection_id and status = 'active'
     and auth.uid() in (owner_user_id, partner_user_id);
  if not found then raise exception 'connection not found'; end if;
end $$;

create or replace function public.send_accountability_nudge(
  p_connection_id uuid, p_message text, p_contract_id uuid default null
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_message is null or char_length(p_message) = 0 or char_length(p_message) > 140 then
    raise exception 'message must be 1-140 characters';
  end if;
  if not exists (select 1 from public.accountability_connections
                 where id = p_connection_id and status = 'active'
                   and auth.uid() in (owner_user_id, partner_user_id)) then
    raise exception 'connection is not active';
  end if;
  if (select count(*) from public.accountability_events
      where sender_user_id = auth.uid() and event_type = 'nudge'
        and created_at > now() - interval '1 day') >= 10 then
    raise exception 'nudge limit reached for today';
  end if;
  insert into public.accountability_events
    (connection_id, contract_id, sender_user_id, event_type, message)
  values (p_connection_id, p_contract_id, auth.uid(), 'nudge', p_message);
end $$;

-- Partner visibility: SECURITY DEFINER view-function returning ONLY shared
-- fields. Never exposes private_note, proof paths, or non-consenting contracts.
create or replace function public.partner_contracts()
returns table (
  contract_id uuid, owner_user_id uuid, title text,
  scheduled_at timestamptz, status text, completed_at timestamptz
)
language sql security definer set search_path = public as $$
  select c.id, c.user_id, c.title, c.scheduled_at, c.status, c.completed_at
  from public.daily_contracts c
  join public.accountability_connections x
    on x.owner_user_id = c.user_id
   and x.partner_user_id = auth.uid()
   and x.status = 'active'
   and c.accountability_enabled = true
   and coalesce((x.sharing_preferences->>'share_status')::boolean, true)
$$;

-- ============ SECTION 14: function grants ============
revoke all on function public.award_contract(uuid, text) from public, anon, authenticated;
grant execute on function public.award_contract(uuid, text) to service_role;

revoke all on function public.verify_contract_proof(uuid, text, numeric, text, text, text)
  from public, anon, authenticated;
grant execute on function public.verify_contract_proof(uuid, text, numeric, text, text, text)
  to service_role;

revoke all on function public.start_contract_session(uuid, uuid, timestamptz) from public, anon;
grant execute on function public.start_contract_session(uuid, uuid, timestamptz)
  to authenticated, service_role;
revoke all on function public.checkpoint_contract_session(uuid, int, int) from public, anon;
grant execute on function public.checkpoint_contract_session(uuid, int, int)
  to authenticated, service_role;
revoke all on function public.end_contract_session(uuid, text, text, int, int) from public, anon;
grant execute on function public.end_contract_session(uuid, text, text, int, int)
  to authenticated, service_role;
revoke all on function public.submit_contract_proof(uuid, uuid, text, text, text) from public, anon;
grant execute on function public.submit_contract_proof(uuid, uuid, text, text, text)
  to authenticated, service_role;
revoke all on function public.start_recovery_contract(uuid, text, timestamptz, text) from public, anon;
grant execute on function public.start_recovery_contract(uuid, text, timestamptz, text)
  to authenticated, service_role;
revoke all on function public.reschedule_contract(uuid, timestamptz, text) from public, anon;
grant execute on function public.reschedule_contract(uuid, timestamptz, text)
  to authenticated, service_role;
revoke all on function public.create_accountability_invite() from public, anon;
grant execute on function public.create_accountability_invite() to authenticated, service_role;
revoke all on function public.accept_accountability_invite(text) from public, anon;
grant execute on function public.accept_accountability_invite(text) to authenticated, service_role;
revoke all on function public.revoke_accountability(uuid) from public, anon;
grant execute on function public.revoke_accountability(uuid) to authenticated, service_role;
revoke all on function public.block_accountability(uuid) from public, anon;
grant execute on function public.block_accountability(uuid) to authenticated, service_role;
revoke all on function public.send_accountability_nudge(uuid, text, uuid) from public, anon;
grant execute on function public.send_accountability_nudge(uuid, text, uuid)
  to authenticated, service_role;
revoke all on function public.partner_contracts() from public, anon;
grant execute on function public.partner_contracts() to authenticated, service_role;
```

---

## 2. RLS access matrix

| Table | authenticated (owner/party) | authenticated (other user / partner) | anonymous | service_role |
|---|---|---|---|---|
| `daily_contracts` | SELECT / INSERT (draft|scheduled, zeroed rewards) / UPDATE own rows | **nothing** — no policy matches | **nothing** (no grant, no policy) | ALL (bypasses RLS) |
| `contract_sessions` | SELECT/INSERT/UPDATE own; DELETE own non-active | nothing | nothing | ALL |
| `proof_submissions` | SELECT / INSERT own (pending-only fields) | nothing | nothing | ALL (status changes only here) |
| `recovery_events` | SELECT own only | nothing | nothing | ALL |
| `accountability_connections` | SELECT (if party), INSERT pending (as owner) | SELECT only if they are the partner of that row | nothing | ALL |
| `accountability_invites` | SELECT own invites only | nothing | nothing | ALL |
| `accountability_events` | SELECT if party of pending/active connection; INSERT as active party | nothing once revoked/blocked (status check in policy) | nothing | ALL |
| `contract_events` | SELECT / INSERT own | nothing | nothing | ALL |
| `score_events` / `coin_transactions` / `profiles` (existing) | **unchanged — zero grants today, zero added** | zero | zero | ALL (existing) |

## 3. Explicit security proofs (guarantee → enforcing mechanism)

1. **Users cannot insert/update score_events rewards.** No INSERT/UPDATE grant on `score_events` to `authenticated` exists (verified live: privilege query returned empty); Phase 1 adds none. Only `award_contract` (service_role EXECUTE only, requires `app.economy_write='on'`) writes the ledger.
2. **Users cannot set proof status to verified.** Three independent layers: (a) no UPDATE grant/policy on `proof_submissions` → permission denied; (b) INSERT policy requires `status='pending'` and null confidence/verifier fields; (c) `guard_proof_submission_fields` trigger re-checks even for paths that bypass RLS. Only `verify_contract_proof` (service_role) can change status.
3. **Users cannot set xp_awarded / coins_awarded / rewarded_at / completed.** (a) INSERT policy requires all zeros/nulls and status in draft|scheduled; (b) `guard_contract_fields` trigger rejects any client UPDATE touching those columns or entering verified/needs_review/retry_requested/rejected/completed/rewarded/recovered/recovery_available without `app.economy_write='on'` (set only inside server RPCs via transaction-local `set_config`); (c) 'completed'/'rewarded' also require the server path via `verify_contract_proof`/`award_contract`.
4. **Users cannot read another user's contract, session, proof, recovery, or event.** Every SELECT policy is `user_id = auth.uid()` (or party-of-connection for accountability_events); anon has no grants/policies at all.
5. **A partner cannot directly query private rows.** Partners match no SELECT policy on `daily_contracts`/`contract_sessions`/`proof_submissions`/`recovery_events`/`contract_events` (policies key on `user_id`, which is always the owner). Partner visibility is exclusively `partner_contracts()` — SECURITY DEFINER, returns only id/title/schedule/status/completion, only for contracts with `accountability_enabled=true` and `share_status` on, only while the connection is `active`.
6. **Invite creator cannot accept their own invite.** `accepted_by <> inviter_user_id` CHECK constraint (database level) + explicit RPC check `v_inv.inviter_user_id = v_uid → raise`.
7. **Revoked partners lose access immediately.** `partner_contracts()` joins on `x.status='active'`; `accountability_events` SELECT policy requires `status in ('pending','active')`. The moment `revoke_accountability`/`block_accountability` flips the row, both the RPC and the events policy exclude the ex-partner on their very next query. Revocation is a single-row UPDATE by either party.

Additional hardening in the same migration: duplicate session start under race → unique partial index violation; duplicate reward under race → `for update` row lock + `status='rewarded'` check + unique `idempotency_key`; one active partner per side → two partial unique indexes; one recovery per contract → `unique(original_contract_id)`; proof spam → 5-per-contract limit; invite spam → 5/day; nudge spam → 10/day, ≤140 chars; storage path escape → prefix must be `contract-proofs/{uid}/`.

## 4. RLS / behaviour test cases (run in Phase 1 verification, not yet executed)

Test harness pattern: `begin; set local role authenticated; set local "request.jwt.claims" = '{"sub":"<USER_UUID>","role":"authenticated"}'; ...`

| # | Test | Expected result |
|---|---|---|
| T1 | anon role queries each new table (`set local role anon`) | permission denied / 0 rows on every table |
| T2 | User A selects User B's contract, session, proof, recovery, contract_event | 0 rows (policy mismatch) |
| T3 | User B inserts a proof for User A's contract | rejected (`user_id = auth.uid()` fails; event/ownership guards also fail) |
| T4 | User A INSERTs proof with `status='verified'` or `confidence=0.9` | rejected by policy + trigger |
| T5 | User A UPDATEs their proof's status | permission denied (no grant) |
| T6 | User A UPDATEs their contract setting `xp_awarded=50` or `status='completed'` | exception "reward fields can only be set by the server" |
| T7 | User A UPDATEs own contract title/time | succeeds (legitimate edit preserved) |
| T8 | User A executes `award_contract(...)` directly | permission denied (EXECUTE not granted to authenticated) |
| T9 | Server awards contract twice (repeat call / replayed idempotency key) | second call returns `idempotent:true`; exactly 1 score_events row, 1 coin_transaction row, profile coins credited once |
| T10 | User A starts two sessions on the same contract concurrently | second insert violates `contract_sessions_one_active` |
| T11 | User A creates 2 primary contracts for the same local_day | second insert violates `daily_contracts_one_primary_per_day`; recovery rows and missed/cancelled days exempt |
| T12 | Inviter accepts own invite token | exception "cannot accept your own invite" (RPC) + CHECK constraint |
| T13 | Same invite token accepted twice | second call: "invite already used" |
| T14 | Expired invite (>7 days) | "invite expired" |
| T15 | Partner queries owner's `daily_contracts` directly | 0 rows; `partner_contracts()` returns only shared fields of consenting contracts |
| T16 | After revoke, ex-partner calls `partner_contracts()` and reads `accountability_events` | empty / 0 rows immediately |
| T17 | Nudge >140 chars, or 11th nudge in 24h, or nudge on non-active connection | exception |
| T18 | User A inserts recovery_event linking User B's contracts | trigger exception "recovery must link two contracts of the same user" |
| T19 | Recovery contract started twice for the same original | "recovery already used" (unique constraint) |
| T20 | User writes contract_event referencing another user's contract | trigger exception |

## 5. Risks and mitigations

- Existing XP/coins untouched: Phase 1 writes nothing to `profiles`, `coin_transactions`, or `score_events` — one nullable `score_events.metadata` column is the only change to an existing table.
- One-contract-per-day index: excludes missed/cancelled/rejected and all recovery rows, so rescues and re-tries never conflict.
- Enum covers the full state machine now — no enum rewrite in later phases.
- Guard trigger vs server: all server RPCs set `app.economy_write='on'` transaction-locally, the same production pattern as Top 3 Missions.
- The 26 pre-existing SECURITY DEFINER linter warnings are unchanged by Phase 1.
- Every function pins `set search_path = public` (no search_path hijacking); every reference is schema-qualified.

## 6. Rollback

Single reversible migration, invisible to the app until Phase 3 mounts UI. Rollback = drop the new tables (none hold data yet at Phase 1), the guard functions, the RPCs, the `contract_status` type, and `alter table public.score_events drop column metadata`. No existing row is ever written, so a rollback cannot lose user data, XP, or coins. Phase 2+ rollback remains frontend-revert only.

## 7. Gate

Nothing is applied now. On your explicit approval I run this exact migration, then deliver the Phase 1 verification report (test results T1–T20 + linter delta) before any Phase 2 work.
