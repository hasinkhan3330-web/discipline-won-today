ALTER TABLE public.contract_events DROP CONSTRAINT IF EXISTS contract_events_kind_check;
ALTER TABLE public.contract_events ADD CONSTRAINT contract_events_kind_check CHECK (kind = ANY (ARRAY[
  'created','scheduled','unscheduled','started','ended','proof_submitted','proof_verified','proof_rejected','rewarded','missed','recovery_started',
  'review_confirmed','review_asked','review_disputed','review_resubmitted','review_resolved']));