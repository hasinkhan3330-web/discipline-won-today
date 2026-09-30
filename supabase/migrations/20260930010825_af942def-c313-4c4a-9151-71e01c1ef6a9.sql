DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_rel pr
    JOIN pg_publication p ON p.oid = pr.prpubid
    WHERE p.pubname = 'supabase_realtime'
      AND pr.prrelid = 'public.accountability_events'::regclass
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.accountability_events;
  END IF;
END $$;