DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'dc_title_len_chk') THEN
    ALTER TABLE public.daily_contracts ADD CONSTRAINT dc_title_len_chk
      CHECK (char_length(btrim(title)) BETWEEN 3 AND 120) NOT VALID;
  END IF;
END $$;