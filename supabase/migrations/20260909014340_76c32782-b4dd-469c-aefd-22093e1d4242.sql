CREATE TABLE public.vision_verifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('gym','shower','focus')),
  source TEXT NOT NULL DEFAULT 'camera' CHECK (source IN ('camera','photo')),
  detections JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.vision_verifications TO authenticated;
GRANT ALL ON public.vision_verifications TO service_role;

ALTER TABLE public.vision_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own_verifications"
  ON public.vision_verifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "users_insert_own_verifications"
  ON public.vision_verifications FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);