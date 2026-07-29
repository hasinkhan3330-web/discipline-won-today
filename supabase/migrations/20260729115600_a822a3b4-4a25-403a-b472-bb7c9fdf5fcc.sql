CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.tasks (user_id, icon, name, pts, sort_order) VALUES
    (NEW.id, '🌅', 'Wake Up 4AM',  10, 1),
    (NEW.id, '💪', 'Workout',      15, 2),
    (NEW.id, '📚', 'Deep Focus',    8, 3),
    (NEW.id, '🍔', 'No Junk Food', 15, 4);

  RETURN NEW;
END;
$$;

UPDATE public.tasks SET is_active = false
WHERE is_active = true
  AND name NOT IN ('Wake Up 4AM', 'Workout', 'Deep Focus', 'No Junk Food');

UPDATE public.tasks SET sort_order = CASE name
    WHEN 'Wake Up 4AM' THEN 1
    WHEN 'Workout' THEN 2
    WHEN 'Deep Focus' THEN 3
    WHEN 'No Junk Food' THEN 4
  END
WHERE is_active = true AND name IN ('Wake Up 4AM', 'Workout', 'Deep Focus', 'No Junk Food');