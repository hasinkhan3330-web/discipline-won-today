# Phase 1 — Database Foundation (review only, nothing applied)

Nothing has been created, changed, or deployed. This is the exact Phase 1 content for your approval.

## Scope of Phase 1

Only additive database structures for the Verified Discipline System. No UI, no routes, no auth, no changes to existing tables' behaviour, no Edge Functions.

## Compatibility checks already run against your live schema

- `profiles` exists, keyed by `id`, holds `coins`, `streak`, `shields`, trial/subscription columns. Reused, not modified.
- `goals` exists (`id`, `user_id`, `title`, `category`, `target_date`, `target_coins`, `earned_coins`). Contracts link to it optionally, on delete set null. Untouched.
- `score_events` exists: `id, user_id, points, kind, idempotency_key, occurred_at, created_at`. Verified XP reuses it — no second XP ledger. It has no `metadata` column, so Phase 1 adds one nullable `jsonb` column (additive, no default rewrite).
- `coin_transactions` exists: `id, user_id, amount, reason, ref_id, created_at`. Contract coins reuse it, no new coin system.
- `protect_verified_reward_fields()` guard pattern already exists and is extended to the new reward-bearing tables using the same `app.economy_write` server-only flag.
- No `daily_contracts`, `contract_sessions`, `proof_submissions`, `recovery_events`, `accountability_*`, or `contract_events` table exists today, so every create is purely new.

## New tables

| Table | Purpose |
|---|---|
| `daily_contracts` | one primary contract per user per local day, plus rescue contracts |
| `contract_sessions` | focus session runs, checkpoints, exit reasons |
| `proof_submissions` | proof records and server-only verification decisions |
| `recovery_events` | links a rescue contract to the missed original (max one) |
| `accountability_connections` / `accountability_invites` / `accountability_events` | optional partner, expiring hashed invite tokens, nudges |
| `contract_events` | append-only audit trail |

## Access rules in plain English

- A signed-in user can read and write only their own contracts, sessions, proofs, recovery records and invites. Signed-out visitors get nothing.
- Users may create a contract and start/stop their own sessions, but cannot mark a proof verified, set XP, or set coins — those columns are rejected at the database level unless the server-side verified function is running.
- Contracts cannot be deleted, so the reward history stays intact; they can be cancelled.
- A partner never reads your rows directly; a dedicated server function returns only the fields you chose to share.
- An invite token is stored hashed, expires, can be accepted once, and cannot be accepted by its creator.

## Migration SQL (to be applied only after approval)

```sql
-- 1. enum + additive column
create type public.contract_status as enum ('draft','scheduled','active','interrupted','proof_pending','verified','needs_review','retry_requested','rejected','completed','rewarded','rescheduled','missed','recovery_available','recovered','cancelled');
alter table public.score_events add column if not exists metadata jsonb;

-- 2. daily_contracts
create table public.daily_contracts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid references public.goals(id) on delete set null,
  title text not null check (char_length(title) between 3 and 120),
  category text not null check (category in ('study','work','exercise','walking','meditation','wake-up','reading','custom')),
  scheduled_at timestamptz not null,
  timezone text not null,
  local_day date not null,
  planned_duration_seconds int not null check (planned_duration_seconds between 300 and 21600),
  rescue_duration_seconds int not null check (rescue_duration_seconds >= 60),
  trigger_text text,
  proof_method text not null check (proof_method in ('timer_recall','zen_session','step_counter','manual_note','qr_mission','photo_optional','timer_checklist','partner_confirm','photo')),
  status public.contract_status not null default 'draft',
  difficulty text not null default 'normal' check (difficulty in ('easy','normal','hard')),
  accountability_enabled boolean not null default false,
  private_note text,
  reminder_pref jsonb not null default '{"prep_minutes":5,"start":true,"missed_followup":true}'::jsonb,
  is_recovery boolean not null default false,
  recovery_of_id uuid references public.daily_contracts(id) on delete set null,
  version int not null default 1,
  started_at timestamptz, completed_at timestamptz, expires_at timestamptz,
  rewarded_at timestamptz,
  xp_awarded int not null default 0, coins_awarded int not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (rescue_duration_seconds <= planned_duration_seconds)
);
create unique index daily_contracts_one_primary_per_day on public.daily_contracts (user_id, local_day)
  where is_recovery = false and status not in ('missed','cancelled','rejected');
create index daily_contracts_user_sched on public.daily_contracts (user_id, scheduled_at);
create index daily_contracts_user_status on public.daily_contracts (user_id, status);

grant select, insert, update on public.daily_contracts to authenticated;
grant all on public.daily_contracts to service_role;
alter table public.daily_contracts enable row level security;
create policy dc_select on public.daily_contracts for select to authenticated using (user_id = auth.uid());
create policy dc_insert on public.daily_contracts for insert to authenticated
  with check (user_id = auth.uid() and status in ('draft','scheduled') and xp_awarded = 0 and coins_awarded = 0 and rewarded_at is null);
create policy dc_update on public.daily_contracts for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- reward + status guard (server-only transitions)
create or replace function public.guard_contract_fields() returns trigger
language plpgsql security definer set search_path = public as $$
declare srv boolean := coalesce(current_setting('app.economy_write', true), 'off') = 'on';
begin
  if tg_op = 'UPDATE' and not srv then
    if new.xp_awarded is distinct from old.xp_awarded
       or new.coins_awarded is distinct from old.coins_awarded
       or new.rewarded_at is distinct from old.rewarded_at
       or (new.status is distinct from old.status and new.status in
           ('verified','needs_review','retry_requested','rejected','completed','rewarded','recovered','recovery_available'))
    then raise exception 'reward fields can only be set by the server'; end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger trg_guard_contract before insert or update on public.daily_contracts
  for each row execute function public.guard_contract_fields();
```

Remaining tables follow the identical four-step shape (CREATE → GRANT → ENABLE RLS → owner-only policies):

- `contract_sessions` — `contract_id`, `user_id`, `started_at`, `expected_end_at`, `ended_at`, `elapsed_seconds`, `pause_seconds`, `exit_reason`, `session_status` (`active|ended|abandoned`), `client_instance_id`, `checkpoint_at`; partial unique index one `active` session per contract.
- `proof_submissions` — `contract_id`, `session_id`, `user_id`, `proof_type`, `private_storage_path`, `text_evidence`, `status` (`pending|verified|needs_review|retry_requested|rejected|unavailable`), `confidence`, `reason_code`, `verifier_version`, `retry_count`; insert policy forces `status='pending'`, trigger blocks client status/confidence writes.
- `recovery_events` — unique on `original_contract_id` (one recovery per contract).
- `accountability_connections` — `check (owner_user_id <> partner_user_id)`, unique pair, partial unique one `active` connection per owner and per partner.
- `accountability_invites` — `token_hash` unique, `expires_at`, `accepted_at`, `accepted_by`, cannot self-accept.
- `accountability_events` — `connection_id`, `contract_id`, `sender_user_id`, `event_type`, `message` (≤140 chars).
- `contract_events` — append-only (`select`/`insert` only for the owner).

No `anon` grants anywhere. No existing table is altered other than the one additive `score_events.metadata` column.

## Risks and mitigations

- Existing XP/coins changing: nothing writes to `profiles`, `coin_transactions`, or `score_events` in Phase 1; only a nullable column is added.
- One-contract-per-day index rejecting a legitimate insert: index excludes missed/cancelled/rejected and recovery rows, so rescheduling and rescue stay possible.
- Enum growth later: statuses listed now cover the full state machine, so no enum rewrite in later phases.
- Guard trigger blocking the server: server RPCs set `app.economy_write='on'` inside SECURITY DEFINER, matching the existing Top 3 Missions pattern already in production.
- Linter noise: the 26 pre-existing SECURITY DEFINER warnings remain; Phase 1 does not add or remove them.

## Rollback

Phase 1 is fully reversible and invisible to the app until Phase 3 mounts UI. Rollback = one migration dropping the new tables, the guard function, and the enum, plus `alter table public.score_events drop column metadata`. No existing row is ever written, so a rollback cannot lose user data or progress.

## Gate

Nothing is applied until you approve. On approval I run only this migration, then stop for the Phase 1 security/verification report before Phase 2.
