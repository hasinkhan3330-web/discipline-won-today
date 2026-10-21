# Phase 1: Accountability database changes (for your approval)

All 8 decisions are confirmed: coin-only stakes, the current navy/blue look, the 70/30 Trust Score, a new 5–10 minute restart, a free-text and mic composer, voice with a keyboard fallback, a timer room with no video, and the existing notifications plus a server backup.

## What this step does
- It only adds new things. Nothing is deleted or renamed, and no existing data changes.
- Contract, Zen, Coach, Rank, Stats, Home, You and 4AM are not touched. Contracts only get three optional new fields; their existing rules stay as they are.
- New tables can only be **read**, and only by the owner or their connected partner. Every write goes through protected server functions, which arrive in Phase 2. Signed-out users get nothing.
- Stake coins use the existing coin history. A new uniqueness rule makes each stake hold, refund and payout happen only once.

## Flagged, not changed
- Today the coin balance has no database-level "never below zero" rule. Adding one could break the existing daily-penalty logic. So Phase 2 blocks negative balances inside the stake functions only: a stake is refused if the coins aren't there. Existing coin logic is untouched.

## Exact SQL

```sql
-- 1. Commitment fields on existing contracts (all optional)
ALTER TABLE public.daily_contracts
  ADD COLUMN IF NOT EXISTS done_criteria text,
  ADD COLUMN IF NOT EXISTS fallback_action text,
  ADD COLUMN IF NOT EXISTS deadline_at timestamptz;
ALTER TABLE public.daily_contracts
  ADD CONSTRAINT dc_done_criteria_len CHECK (done_criteria IS NULL OR char_length(done_criteria) <= 200),
  ADD CONSTRAINT dc_fallback_len CHECK (fallback_action IS NULL OR char_length(fallback_action) <= 200);

-- 2. Shared helper: is the caller a party to an active connection?
CREATE OR REPLACE FUNCTION public.acct_is_party(_connection uuid, _uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.accountability_connections c
    WHERE c.id = _connection AND (c.user_id = _uid OR c.partner_id = _uid));
$$;
REVOKE ALL ON FUNCTION public.acct_is_party(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.acct_is_party(uuid, uuid) TO authenticated;

-- 3. Dual-stake pacts
CREATE TABLE public.pact_stakes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES public.accountability_connections(id),
  creator_id uuid NOT NULL,
  partner_id uuid NOT NULL,
  creator_contract_id uuid NOT NULL REFERENCES public.daily_contracts(id),
  partner_contract_id uuid REFERENCES public.daily_contracts(id),
  stake_coins integer NOT NULL CHECK (stake_coins BETWEEN 10 AND 500),
  terms_version integer NOT NULL DEFAULT 1,
  creator_accepted_at timestamptz,
  partner_accepted_at timestamptz,
  state text NOT NULL DEFAULT 'pending' CHECK (state IN
    ('pending','active','escrowed','awaiting_review','approved','rejected','disputed','settled','cancelled')),
  outcome text CHECK (outcome IS NULL OR outcome IN
    ('both_approved','creator_won','partner_won','both_missed','mutual_cancel','review_timeout','dispute_timeout','dispute_resolved')),
  cancel_requested_by uuid,
  settled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (creator_id <> partner_id)
);
CREATE UNIQUE INDEX pact_stakes_creator_contract_uq ON public.pact_stakes(creator_contract_id);
CREATE UNIQUE INDEX pact_stakes_partner_contract_uq ON public.pact_stakes(partner_contract_id) WHERE partner_contract_id IS NOT NULL;
CREATE INDEX pact_stakes_open_idx ON public.pact_stakes(state, updated_at) WHERE state NOT IN ('settled','cancelled');
GRANT SELECT ON public.pact_stakes TO authenticated;
GRANT ALL ON public.pact_stakes TO service_role;
ALTER TABLE public.pact_stakes ENABLE ROW LEVEL SECURITY;
CREATE POLICY pact_stakes_party_read ON public.pact_stakes FOR SELECT TO authenticated
  USING (auth.uid() = creator_id OR auth.uid() = partner_id);

-- 4. Exactly-once coin movements for stakes (existing ledger: public.coin_transactions, columns user_id, reason, ref_id — confirmed)
CREATE UNIQUE INDEX coin_pact_once ON public.coin_transactions(user_id, reason, ref_id)
  WHERE reason IN ('pact_hold','pact_refund','pact_payout');

-- 5. Disputes (24h window, written reason, one per proof)
CREATE TABLE public.pact_disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pact_id uuid NOT NULL REFERENCES public.pact_stakes(id),
  proof_id uuid NOT NULL REFERENCES public.proof_submissions(id),
  opened_by uuid NOT NULL,
  reason text NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 3 AND 300),
  opened_at timestamptz NOT NULL DEFAULT now(),
  closes_at timestamptz NOT NULL,
  resolution text CHECK (resolution IS NULL OR resolution IN ('approved','timeout_refund')),
  resolved_at timestamptz
);
CREATE UNIQUE INDEX pact_disputes_proof_uq ON public.pact_disputes(proof_id);
GRANT SELECT ON public.pact_disputes TO authenticated;
GRANT ALL ON public.pact_disputes TO service_role;
ALTER TABLE public.pact_disputes ENABLE ROW LEVEL SECURITY;
CREATE POLICY pact_disputes_party_read ON public.pact_disputes FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pact_stakes p WHERE p.id = pact_id
    AND (auth.uid() = p.creator_id OR auth.uid() = p.partner_id)));

-- 6. Trust events (70/30 score inputs)
CREATE TABLE public.trust_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('commitment','review')),
  ref_id uuid NOT NULL,
  kept boolean NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX trust_events_once ON public.trust_events(user_id, kind, ref_id);
GRANT SELECT ON public.trust_events TO authenticated;
GRANT ALL ON public.trust_events TO service_role;
ALTER TABLE public.trust_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY trust_events_own_read ON public.trust_events FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- 7. Co-focus sessions
CREATE TABLE public.cofocus_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES public.accountability_connections(id),
  host_id uuid NOT NULL,
  guest_id uuid NOT NULL,
  task_title text NOT NULL CHECK (char_length(btrim(task_title)) BETWEEN 1 AND 100),
  minutes integer NOT NULL CHECK (minutes IN (25,50,75)),
  quiet_mode boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'ready' CHECK (status IN ('ready','active','completed','cancelled','interrupted','no_show')),
  host_seen_at timestamptz,
  guest_seen_at timestamptz,
  starts_at timestamptz,
  ends_at timestamptz,
  host_checkin text CHECK (host_checkin IS NULL OR host_checkin IN ('completed','partial','not_completed')),
  guest_checkin text CHECK (guest_checkin IS NULL OR guest_checkin IN ('completed','partial','not_completed')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX cofocus_one_open_per_connection ON public.cofocus_sessions(connection_id)
  WHERE status IN ('ready','active');
GRANT SELECT ON public.cofocus_sessions TO authenticated;
GRANT ALL ON public.cofocus_sessions TO service_role;
ALTER TABLE public.cofocus_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY cofocus_party_read ON public.cofocus_sessions FOR SELECT TO authenticated
  USING (auth.uid() = host_id OR auth.uid() = guest_id);

-- 8. Recovery choices (history is never erased)
CREATE TABLE public.recovery_choices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  contract_id uuid NOT NULL REFERENCES public.daily_contracts(id),
  reason text NOT NULL CHECK (reason IN ('too_much','started_late','unexpected','low_energy','other')),
  action text NOT NULL CHECK (action IN ('restart','reduce_scope','reschedule')),
  restart_minutes integer CHECK (restart_minutes IS NULL OR restart_minutes BETWEEN 5 AND 10),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX recovery_choices_once ON public.recovery_choices(contract_id);
GRANT SELECT ON public.recovery_choices TO authenticated;
GRANT ALL ON public.recovery_choices TO service_role;
ALTER TABLE public.recovery_choices ENABLE ROW LEVEL SECURITY;
CREATE POLICY recovery_choices_own_read ON public.recovery_choices FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- 9. Free-text partner messages
CREATE TABLE public.partner_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES public.accountability_connections(id),
  sender_id uuid NOT NULL,
  recipient_id uuid NOT NULL,
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 280),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX partner_messages_conv_idx ON public.partner_messages(connection_id, created_at DESC);
GRANT SELECT ON public.partner_messages TO authenticated;
GRANT ALL ON public.partner_messages TO service_role;
ALTER TABLE public.partner_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY partner_messages_party_read ON public.partner_messages FOR SELECT TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = recipient_id);
ALTER PUBLICATION supabase_realtime ADD TABLE public.partner_messages;

-- 10. Early-warning reminders (one per commitment)
CREATE TABLE public.commitment_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  contract_id uuid NOT NULL REFERENCES public.daily_contracts(id),
  kind text NOT NULL DEFAULT 'early_warning' CHECK (kind IN ('early_warning')),
  idempotency_key text NOT NULL UNIQUE,
  fire_at timestamptz NOT NULL,
  timezone text NOT NULL,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','sent','suppressed','skipped')),
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX commitment_reminders_once ON public.commitment_reminders(contract_id, kind);
CREATE INDEX commitment_reminders_due_idx ON public.commitment_reminders(fire_at) WHERE status = 'scheduled';
GRANT SELECT ON public.commitment_reminders TO authenticated;
GRANT ALL ON public.commitment_reminders TO service_role;
ALTER TABLE public.commitment_reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY commitment_reminders_own_read ON public.commitment_reminders FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- 11. Keep existing nudge history; mark template sending retired
COMMENT ON FUNCTION public.send_accountability_nudge IS
  'DEPRECATED for template nudges/emergency: replaced by partner_messages composer. Check-in path retained.';
```

## After you approve
1. Apply this exact SQL, then confirm with reads that the tables and rules exist and that signed-out users are denied.
2. Show you Phase 2: the exact settlement, dispute, trust, co-focus, recovery, message and reminder functions, for approval before they run.
