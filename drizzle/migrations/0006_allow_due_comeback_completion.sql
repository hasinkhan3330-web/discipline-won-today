DO $$ DECLARE _def text; BEGIN
 SELECT pg_get_functiondef('public.guard_contract_fields()'::regprocedure) INTO _def;
 IF position('(OLD.status = ''active''        AND NEW.status IN (''proof_pending'',''missed''))' IN _def)=0 THEN RAISE EXCEPTION 'Expected existing transition guard not found'; END IF;
 _def:=replace(_def,'(OLD.status = ''active''        AND NEW.status IN (''proof_pending'',''missed''))','(OLD.status = ''active''        AND NEW.status IN (''proof_pending'',''missed'')) OR (OLD.status = ''active'' AND NEW.status = ''rewarded'' AND OLD.is_recovery AND OLD.comeback_ends_at IS NOT NULL AND OLD.comeback_ends_at <= now() AND OLD.comeback_ends_at <= OLD.expires_at)');
 EXECUTE _def;
END $$;