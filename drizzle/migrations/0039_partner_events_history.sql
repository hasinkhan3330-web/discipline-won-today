CREATE TABLE public.partner_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL,
  from_user uuid NOT NULL,
  to_user uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('nudge','cheer','emergency')),
  text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  seen_at timestamptz
);
CREATE INDEX partner_events_to_idx ON public.partner_events (to_user, created_at DESC);
CREATE INDEX partner_events_from_idx ON public.partner_events (from_user, created_at DESC);

GRANT SELECT ON public.partner_events TO authenticated;
GRANT UPDATE (seen_at) ON public.partner_events TO authenticated;
GRANT ALL ON public.partner_events TO service_role;

ALTER TABLE public.partner_events ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.acct_connection_active_for(_connection_id uuid, _uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.accountability_connections c
    WHERE c.id = _connection_id AND c.status = 'active' AND (c.user_id = _uid OR c.partner_id = _uid));
$$;
REVOKE ALL ON FUNCTION public.acct_connection_active_for(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.acct_connection_active_for(uuid, uuid) TO authenticated;

CREATE POLICY "partner_events_select_parties" ON public.partner_events FOR SELECT TO authenticated
  USING (auth.uid() IN (from_user, to_user) AND public.acct_connection_active_for(connection_id, auth.uid()));
CREATE POLICY "partner_events_recipient_mark_seen" ON public.partner_events FOR UPDATE TO authenticated
  USING (to_user = auth.uid() AND public.acct_connection_active_for(connection_id, auth.uid()))
  WITH CHECK (to_user = auth.uid());

CREATE OR REPLACE FUNCTION public.partner_events_from_acct_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.kind IN ('nudge','emergency') AND NEW.connection_id IS NOT NULL AND NEW.recipient_id IS NOT NULL THEN
    BEGIN
      INSERT INTO public.partner_events(connection_id, from_user, to_user, kind, text, created_at)
      VALUES (NEW.connection_id, NEW.actor_id, NEW.recipient_id, NEW.kind, coalesce(NEW.message, ''), coalesce(NEW.created_at, now()));
    EXCEPTION WHEN others THEN
      RAISE WARNING 'partner_events insert failed (accountability_events %): %', NEW.id, SQLERRM;
    END;
  END IF;
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.partner_events_from_cheer()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  BEGIN
    INSERT INTO public.partner_events(connection_id, from_user, to_user, kind, text, created_at)
    VALUES (NEW.connection_id, NEW.sender_id, NEW.recipient_id, 'cheer',
      CASE NEW.kind WHEN 'fire' THEN '🔥' WHEN 'clap' THEN '👏' WHEN 'muscle' THEN '💪' ELSE NEW.kind END,
      coalesce(NEW.created_at, now()));
  EXCEPTION WHEN others THEN
    RAISE WARNING 'partner_events insert failed (acct_cheers %): %', NEW.id, SQLERRM;
  END;
  RETURN NULL;
END $$;

REVOKE ALL ON FUNCTION public.partner_events_from_acct_event() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.partner_events_from_cheer() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER partner_events_log_nudge AFTER INSERT ON public.accountability_events
  FOR EACH ROW EXECUTE FUNCTION public.partner_events_from_acct_event();
CREATE TRIGGER partner_events_log_cheer AFTER INSERT ON public.acct_cheers
  FOR EACH ROW EXECUTE FUNCTION public.partner_events_from_cheer();