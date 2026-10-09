CREATE OR REPLACE FUNCTION public.guard_milestone_seals() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
 IF (TG_OP <> 'DELETE' AND NEW.reward_key LIKE 'milestone\_seal\_%') OR (TG_OP <> 'INSERT' AND OLD.reward_key LIKE 'milestone\_seal\_%') THEN
  IF current_user IN ('authenticated','anon','authenticator') THEN RAISE EXCEPTION 'milestone seals are server-only'; END IF;
 END IF;
 IF TG_OP = 'DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_milestone_seals() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER guard_milestone_seal_rows BEFORE INSERT OR UPDATE OR DELETE ON public.unlock_rewards FOR EACH ROW EXECUTE FUNCTION public.guard_milestone_seals();

CREATE OR REPLACE FUNCTION public.sync_milestone_seals(_user_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 INSERT INTO public.unlock_rewards(user_id,reward_key,metadata)
 SELECT p.id, 'milestone_seal_' || m.days, jsonb_build_object('milestone',m.days,'threshold',m.coins)
 FROM public.profiles p CROSS JOIN (VALUES (7,350),(21,1050),(100,5000),(290,14500),(365,18250)) m(days,coins)
 WHERE p.id=_user_id AND p.coins>=m.coins
 ON CONFLICT(user_id,reward_key) DO NOTHING;
END $$;
REVOKE ALL ON FUNCTION public.sync_milestone_seals(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_milestone_seals(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.on_profile_milestone_coins() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN PERFORM public.sync_milestone_seals(NEW.id); RETURN NEW; END $$;
REVOKE ALL ON FUNCTION public.on_profile_milestone_coins() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER sync_profile_milestone_seals AFTER INSERT OR UPDATE OF coins ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.on_profile_milestone_coins();

CREATE OR REPLACE FUNCTION public.get_my_milestone_seals() RETURNS TABLE(milestone integer,unlocked_at timestamptz) LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _uid uuid:=auth.uid();
BEGIN
 IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
 PERFORM public.sync_milestone_seals(_uid);
 RETURN QUERY SELECT (u.metadata->>'milestone')::integer,u.unlocked_at FROM public.unlock_rewards u WHERE u.user_id=_uid AND u.reward_key IN ('milestone_seal_7','milestone_seal_21','milestone_seal_100','milestone_seal_290','milestone_seal_365') ORDER BY (u.metadata->>'milestone')::integer;
END $$;
REVOKE ALL ON FUNCTION public.get_my_milestone_seals() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_milestone_seals() TO authenticated;

CREATE OR REPLACE FUNCTION public.consume_milestone_seal_shines() RETURNS TABLE(milestone integer) LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _uid uuid:=auth.uid();
BEGIN
 IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
 RETURN QUERY UPDATE public.unlock_rewards u SET metadata=u.metadata || jsonb_build_object('shine_seen_at',now())
 WHERE u.user_id=_uid AND u.reward_key IN ('milestone_seal_7','milestone_seal_21','milestone_seal_100','milestone_seal_290','milestone_seal_365') AND NOT u.metadata ? 'shine_seen_at'
 RETURNING (u.metadata->>'milestone')::integer;
END $$;
REVOKE ALL ON FUNCTION public.consume_milestone_seal_shines() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_milestone_seal_shines() TO authenticated;