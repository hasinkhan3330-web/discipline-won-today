-- Read-only catalog checks; exact authenticated membership is exercised through browser RPCs.
SELECT prosecdef AND proconfig @> ARRAY['search_path=""'] AS pinned_security_definer,
       NOT has_function_privilege('anon', oid, 'EXECUTE') AS anonymous_denied,
       has_function_privilege('authenticated', oid, 'EXECUTE') AS authenticated_allowed
FROM pg_proc WHERE oid = 'public.get_verified_rank_coins(text,text)'::regprocedure;
SELECT pg_get_function_result('public.get_verified_rank_coins(text,text)'::regprocedure)
       = 'TABLE(user_id uuid, coins_earned integer, highest_seal_tier text)' AS safe_fields_only;
SELECT NOT EXISTS (
 SELECT 1 FROM (VALUES (0,NULL::text),(349,NULL),(350,'bronze'),(400,'bronze'),(1049,'bronze'),(1050,'silver'),(5000,'gold'),(14500,'amethyst'),(18250,'diamond')) f(coins,expected)
 WHERE (SELECT tier FROM (VALUES (350,'bronze'),(1050,'silver'),(5000,'gold'),(14500,'amethyst'),(18250,'diamond')) t(threshold,tier)
        WHERE f.coins>=t.threshold ORDER BY threshold DESC LIMIT 1) IS DISTINCT FROM f.expected
) AS boundaries_pass;