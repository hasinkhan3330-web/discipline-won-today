CREATE OR REPLACE FUNCTION public.wake_slot_reward(_slot text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE upper(trim(_slot))
    WHEN '4AM' THEN 10
    WHEN '5AM' THEN 7
    WHEN '6AM' THEN 5
    WHEN '7AM' THEN 3
    ELSE 0 END;
$$;