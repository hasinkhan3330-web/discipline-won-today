ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS gym_lat double precision,
  ADD COLUMN IF NOT EXISTS gym_lng double precision,
  ADD COLUMN IF NOT EXISTS gym_radius_m integer NOT NULL DEFAULT 150;