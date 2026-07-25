
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_penalty_date date;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.tasks (user_id, icon, name, pts, sort_order) VALUES
    (NEW.id, '🌅', 'Wake Up 4AM',   10, 1),
    (NEW.id, '🚿', 'Cold Shower',    4, 2),
    (NEW.id, '💪', 'Workout',       15, 3),
    (NEW.id, '📚', 'Deep Focus',     8, 4),
    (NEW.id, '📵', 'Phone Free',     5, 5),
    (NEW.id, '🎯', 'Daily Goals',    4, 6),
    (NEW.id, '🍔', 'No Junk Food',  15, 7),
    (NEW.id, '🧘', 'Meditation',    10, 8);

  RETURN NEW;
END; $function$;
