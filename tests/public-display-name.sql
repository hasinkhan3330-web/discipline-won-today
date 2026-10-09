-- Read-only assertions; no user data is created or modified.
SELECT public.axen_public_display_name(' Hasin Khan ', '11111111-2222-3333-4444-55555555abcd') = 'Hasin Khan' AS valid_name,
       public.axen_public_display_name('', '11111111-2222-3333-4444-55555555abcd') = 'Axen Member abcd' AS empty_name,
       public.axen_public_display_name(NULL, '11111111-2222-3333-4444-55555555abcd') = 'Axen Member abcd' AS null_name,
       public.axen_public_display_name('private@example.test', '11111111-2222-3333-4444-55555555abcd') = 'Axen Member abcd' AS email_name;
SELECT count(*) = 0 AS unsafe_public_names FROM public.public_profiles
WHERE display_name LIKE '%@%' OR username LIKE '%@%';
SELECT count(*) = 0 AS unsafe_leaderboard_names
FROM public.leaderboard_top('global','alltime',100,0) WHERE username LIKE '%@%';
SELECT pg_get_functiondef('public.leaderboard_top(text,text,integer,integer)'::regprocedure) NOT LIKE '%p.username%'
AND pg_get_functiondef('public.leaderboard_top(text,text,integer,integer)'::regprocedure) NOT LIKE '%email%'
AND pg_get_viewdef('public.public_profiles'::regclass) NOT LIKE '%email%' AS no_email_or_username_source;