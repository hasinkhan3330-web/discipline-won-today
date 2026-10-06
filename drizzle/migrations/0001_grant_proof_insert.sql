-- The owner-only insert policy and guard trigger already exist; the table grant was missing, so proof could never be saved.
GRANT INSERT ON public.proof_submissions TO authenticated;