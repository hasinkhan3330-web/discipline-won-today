CREATE TABLE public.first_launch_assessments (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  baseline_score integer NOT NULL CHECK (baseline_score BETWEEN 0 AND 100),
  estimated_daily_lost_hours numeric(5,2) NOT NULL CHECK (estimated_daily_lost_hours >= 0),
  potential_daily_reclaim_hours numeric(5,2) NOT NULL CHECK (potential_daily_reclaim_hours >= 0),
  completed_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.first_launch_assessments TO authenticated;
GRANT ALL ON public.first_launch_assessments TO service_role;

ALTER TABLE public.first_launch_assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own first launch assessment"
ON public.first_launch_assessments
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own first launch assessment"
ON public.first_launch_assessments
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own first launch assessment"
ON public.first_launch_assessments
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_first_launch_assessments_updated_at
BEFORE UPDATE ON public.first_launch_assessments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();