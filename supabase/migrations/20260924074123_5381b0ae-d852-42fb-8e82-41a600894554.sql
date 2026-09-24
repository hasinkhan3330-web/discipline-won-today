ALTER TABLE public.daily_contracts
  ADD COLUMN IF NOT EXISTS reminder_pref text NOT NULL DEFAULT 'standard';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dc_reminder_pref_chk') THEN
    ALTER TABLE public.daily_contracts ADD CONSTRAINT dc_reminder_pref_chk CHECK (reminder_pref IN ('none','standard','early'));
  END IF;
END $$;

DROP INDEX IF EXISTS public.dc_one_primary_per_day;
CREATE UNIQUE INDEX IF NOT EXISTS dc_one_primary_per_day
  ON public.daily_contracts (user_id, local_day)
  WHERE is_recovery = false AND status <> 'cancelled'::public.contract_status;

DROP POLICY IF EXISTS dc_update_own_editable ON public.daily_contracts;
CREATE POLICY dc_update_own_editable ON public.daily_contracts
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND status IN ('draft','scheduled'))
  WITH CHECK (user_id = auth.uid() AND status IN ('draft','scheduled','cancelled'));

CREATE OR REPLACE FUNCTION public.guard_contract_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE
  _server boolean := public.axen_is_server_write();
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name = NEW.timezone) THEN
    RAISE EXCEPTION 'invalid timezone %', NEW.timezone USING ERRCODE = '22023';
  END IF;
  NEW.local_day := (NEW.scheduled_at AT TIME ZONE NEW.timezone)::date;
  NEW.updated_at := now();

  IF NEW.goal_id IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM public.goals g WHERE g.id = NEW.goal_id AND g.user_id = NEW.user_id) THEN
    RAISE EXCEPTION 'goal does not belong to user' USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NOT _server THEN
      IF NEW.user_id IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'user_id must be caller' USING ERRCODE = '42501';
      END IF;
      IF NEW.status NOT IN ('draft','scheduled')
         OR NEW.is_recovery OR NEW.recovery_of_id IS NOT NULL
         OR NEW.xp_awarded <> 0 OR NEW.coins_awarded <> 0
         OR NEW.started_at IS NOT NULL OR NEW.completed_at IS NOT NULL
         OR NEW.rewarded_at IS NOT NULL OR NEW.expires_at IS NOT NULL
         OR NEW.version <> 1 THEN
        RAISE EXCEPTION 'server-only fields cannot be set by client' USING ERRCODE = '42501';
      END IF;
      IF NEW.scheduled_at < now() - interval '5 minutes' THEN
        RAISE EXCEPTION 'scheduled_at in the past' USING ERRCODE = '22023';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.id <> OLD.id OR NEW.user_id <> OLD.user_id OR NEW.created_at <> OLD.created_at THEN
    RAISE EXCEPTION 'immutable column changed' USING ERRCODE = '42501';
  END IF;
  IF NEW.is_recovery IS DISTINCT FROM OLD.is_recovery
     OR NEW.recovery_of_id IS DISTINCT FROM OLD.recovery_of_id THEN
    RAISE EXCEPTION 'recovery flags are immutable' USING ERRCODE = '42501';
  END IF;
  IF OLD.status = 'rewarded' AND (NEW.status <> 'rewarded'
       OR NEW.xp_awarded <> OLD.xp_awarded OR NEW.coins_awarded <> OLD.coins_awarded
       OR NEW.rewarded_at IS DISTINCT FROM OLD.rewarded_at) THEN
    RAISE EXCEPTION 'rewarded contract is final' USING ERRCODE = '42501';
  END IF;
  IF OLD.status = 'cancelled' THEN
    RAISE EXCEPTION 'cancelled contract is final' USING ERRCODE = '42501';
  END IF;

  IF NOT _server THEN
    IF OLD.user_id <> auth.uid() THEN
      RAISE EXCEPTION 'not owner' USING ERRCODE = '42501';
    END IF;
    IF NEW.xp_awarded <> OLD.xp_awarded OR NEW.coins_awarded <> OLD.coins_awarded
       OR NEW.rewarded_at IS DISTINCT FROM OLD.rewarded_at
       OR NEW.completed_at IS DISTINCT FROM OLD.completed_at
       OR NEW.started_at IS DISTINCT FROM OLD.started_at
       OR NEW.expires_at IS DISTINCT FROM OLD.expires_at
       OR NEW.version <> OLD.version THEN
      RAISE EXCEPTION 'server-only fields cannot be changed by client' USING ERRCODE = '42501';
    END IF;
    IF OLD.status NOT IN ('draft','scheduled') THEN
      RAISE EXCEPTION 'contract locked in status %', OLD.status USING ERRCODE = '42501';
    END IF;
    IF NEW.status NOT IN ('draft','scheduled','cancelled') THEN
      RAISE EXCEPTION 'status % is server-only', NEW.status USING ERRCODE = '42501';
    END IF;
    IF NEW.scheduled_at IS DISTINCT FROM OLD.scheduled_at AND NEW.scheduled_at < now() - interval '5 minutes' THEN
      RAISE EXCEPTION 'scheduled_at in the past' USING ERRCODE = '22023';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.status <> OLD.status AND NOT (
       (OLD.status = 'draft'         AND NEW.status IN ('scheduled','cancelled')) OR
       (OLD.status = 'scheduled'     AND NEW.status IN ('draft','active','missed','cancelled')) OR
       (OLD.status = 'active'        AND NEW.status IN ('proof_pending','missed')) OR
       (OLD.status = 'proof_pending' AND NEW.status IN ('verified','missed')) OR
       (OLD.status = 'verified'      AND NEW.status IN ('rewarded'))
     ) THEN
    RAISE EXCEPTION 'invalid transition % -> %', OLD.status, NEW.status USING ERRCODE = '22023';
  END IF;
  IF NEW.status <> OLD.status THEN
    NEW.version := OLD.version + 1;
  END IF;
  RETURN NEW;
END;
$function$;