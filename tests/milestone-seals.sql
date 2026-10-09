-- Run with psql -v owner=<temporary-user-uuid> -v other=<temporary-user-uuid>.
-- All changes roll back. Fixtures must be isolated test profiles.
BEGIN;
SELECT set_config('test.seal_owner', :'owner', true), set_config('test.seal_other', :'other', true);
SELECT set_config('app.economy_write','on',true);
DO $$
DECLARE uid uuid:=current_setting('test.seal_owner')::uuid; b record; actual integer[]; baseline_coins bigint; baseline_xp bigint;
BEGIN
 SELECT coalesce(sum(amount),0) INTO baseline_coins FROM public.coin_transactions WHERE user_id=uid;
 SELECT coalesce(sum(points),0) INTO baseline_xp FROM public.score_events WHERE user_id=uid;
 FOR b IN SELECT * FROM (VALUES
 (349,ARRAY[]::integer[]),(350,ARRAY[7]),(1049,ARRAY[7]),(1050,ARRAY[7,21]),
 (4999,ARRAY[7,21]),(5000,ARRAY[7,21,100]),(14499,ARRAY[7,21,100]),
 (14500,ARRAY[7,21,100,290]),(18249,ARRAY[7,21,100,290]),(18250,ARRAY[7,21,100,290,365]))v(coins,expected)
 LOOP
  UPDATE public.profiles SET coins=b.coins,streak=0,longest_streak=0 WHERE id=uid;
  SELECT coalesce(array_agg((metadata->>'milestone')::integer ORDER BY (metadata->>'milestone')::integer),ARRAY[]::integer[]) INTO actual FROM public.unlock_rewards WHERE user_id=uid AND reward_key LIKE 'milestone\_seal\_%';
  IF actual<>b.expected THEN RAISE EXCEPTION 'threshold % failed: %',b.coins,actual; END IF;
 END LOOP;
 UPDATE public.profiles SET coins=349,streak=365,longest_streak=365 WHERE id=current_setting('test.seal_other')::uuid;
 IF EXISTS(SELECT 1 FROM public.unlock_rewards WHERE user_id=current_setting('test.seal_other')::uuid AND reward_key LIKE 'milestone\_seal\_%') THEN RAISE EXCEPTION 'streak granted seal below 350'; END IF;
 UPDATE public.profiles SET coins=0 WHERE id=uid;
 IF (SELECT count(*) FROM public.unlock_rewards WHERE user_id=uid AND reward_key LIKE 'milestone\_seal\_%')<>5 THEN RAISE EXCEPTION 'earned seals lost'; END IF;
 IF (SELECT coalesce(sum(amount),0) FROM public.coin_transactions WHERE user_id=uid)<>baseline_coins OR (SELECT coalesce(sum(points),0) FROM public.score_events WHERE user_id=uid)<>baseline_xp THEN RAISE EXCEPTION 'seal changed rewards'; END IF;
 RAISE NOTICE 'PASS: ten boundaries, low streak eligibility, high streak denial, permanence, unchanged reward ledgers';
END $$;
SELECT set_config('request.jwt.claim.sub', :'owner', true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE uid uuid:=auth.uid();
BEGIN
 IF (SELECT count(*) FROM public.get_my_milestone_seals())<>5 THEN RAISE EXCEPTION 'own read failed'; END IF;
 IF EXISTS(SELECT 1 FROM public.unlock_rewards WHERE user_id<>uid) THEN RAISE EXCEPTION 'cross-user read allowed'; END IF;
 BEGIN INSERT INTO public.unlock_rewards(user_id,reward_key,metadata) VALUES(uid,'milestone_seal_forged','{}'); RAISE EXCEPTION 'forge allowed'; EXCEPTION WHEN insufficient_privilege OR raise_exception THEN IF SQLERRM='forge allowed' THEN RAISE; END IF; END;
 BEGIN UPDATE public.unlock_rewards SET metadata='{}' WHERE user_id=uid AND reward_key='milestone_seal_7'; RAISE EXCEPTION 'mutation allowed'; EXCEPTION WHEN insufficient_privilege OR raise_exception THEN IF SQLERRM='mutation allowed' THEN RAISE; END IF; END;
 BEGIN INSERT INTO public.unlock_rewards(user_id,reward_key,metadata) VALUES(uid,'seal_test_other','{}'); UPDATE public.unlock_rewards SET reward_key='milestone_seal_forged' WHERE user_id=uid AND reward_key='seal_test_other'; RAISE EXCEPTION 'rename allowed'; EXCEPTION WHEN insufficient_privilege OR raise_exception THEN IF SQLERRM='rename allowed' THEN RAISE; END IF; END;
 IF (SELECT count(*) FROM public.consume_milestone_seal_shines())<>5 THEN RAISE EXCEPTION 'initial shine failed'; END IF;
 IF (SELECT count(*) FROM public.consume_milestone_seal_shines())<>0 THEN RAISE EXCEPTION 'shine repeated'; END IF;
 RAISE NOTICE 'PASS: own read, cross-user denial, forgery/mutation/key-rename denied, one-time shine';
END $$;
ROLLBACK;