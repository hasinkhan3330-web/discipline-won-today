-- Run against an active temporary comeback, before and after backdating its end.
-- Set qa.comeback_id to a temporary contract UUID in the same session.
DO $$ DECLARE c public.daily_contracts; BEGIN
 SELECT * INTO c FROM public.daily_contracts WHERE id=current_setting('qa.comeback_id')::uuid;
 IF c.id IS NULL THEN RAISE EXCEPTION 'temporary comeback missing'; END IF;
 IF c.planned_seconds <> 900 THEN RAISE EXCEPTION 'comeback must be 900 seconds'; END IF;
 IF c.status='rewarded' THEN
  IF c.xp_awarded<>8 OR c.coins_awarded<>2 THEN RAISE EXCEPTION 'wrong uncapped test reward'; END IF;
  IF (SELECT count(*) FROM public.score_events WHERE idempotency_key='contract:'||c.id)<>1 THEN RAISE EXCEPTION 'XP ledger not exactly once'; END IF;
  IF (SELECT count(*) FROM public.coin_transactions WHERE ref_id=c.id)<>1 THEN RAISE EXCEPTION 'coin ledger not exactly once'; END IF;
 ELSIF c.status<>'active' THEN RAISE EXCEPTION 'unexpected test state'; END IF;
END $$;
