-- 1. Shared quiz question bank
CREATE TABLE public.quiz_questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  subject TEXT NOT NULL CHECK (subject IN ('math','science')),
  difficulty TEXT NOT NULL DEFAULT 'easy' CHECK (difficulty IN ('easy','medium','hard')),
  question_text TEXT NOT NULL,
  options JSONB,
  correct_answer TEXT NOT NULL,
  explanation TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.quiz_questions TO authenticated;
GRANT ALL ON public.quiz_questions TO service_role;
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed in users can read active questions"
  ON public.quiz_questions FOR SELECT TO authenticated USING (is_active);

-- 2. Attempts
CREATE TABLE public.quiz_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  alarm_id UUID,
  question_id UUID REFERENCES public.quiz_questions(id) ON DELETE SET NULL,
  subject TEXT,
  answer_given TEXT,
  correct BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX quiz_attempts_user_idx ON public.quiz_attempts(user_id, created_at DESC);
GRANT SELECT, INSERT ON public.quiz_attempts TO authenticated;
GRANT ALL ON public.quiz_attempts TO service_role;
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own attempts" ON public.quiz_attempts
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own attempts" ON public.quiz_attempts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- 3. One-time unlocks
CREATE TABLE public.unlock_rewards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  reward_key TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, reward_key)
);
GRANT SELECT, INSERT, UPDATE ON public.unlock_rewards TO authenticated;
GRANT ALL ON public.unlock_rewards TO service_role;
ALTER TABLE public.unlock_rewards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own unlocks" ON public.unlock_rewards
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users create own unlocks" ON public.unlock_rewards
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own unlocks" ON public.unlock_rewards
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 4. Coach notes
CREATE TABLE public.coach_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  note_date DATE NOT NULL DEFAULT CURRENT_DATE,
  summary_text TEXT NOT NULL,
  consistency_score INTEGER NOT NULL DEFAULT 0,
  recommended_focus TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, note_date)
);
GRANT SELECT, INSERT, UPDATE ON public.coach_notes TO authenticated;
GRANT ALL ON public.coach_notes TO service_role;
ALTER TABLE public.coach_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own coach notes" ON public.coach_notes
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users create own coach notes" ON public.coach_notes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own coach notes" ON public.coach_notes
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_unlock_rewards_updated_at BEFORE UPDATE ON public.unlock_rewards
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_coach_notes_updated_at BEFORE UPDATE ON public.coach_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed question bank
INSERT INTO public.quiz_questions (subject, difficulty, question_text, options, correct_answer, explanation) VALUES
('science','easy','Which gas do plants absorb for photosynthesis?','["Oxygen","Carbon dioxide","Nitrogen","Helium"]','Carbon dioxide',null),
('science','easy','What is the SI unit of force?','["Joule","Watt","Newton","Pascal"]','Newton',null),
('science','easy','Speed of light in vacuum is about…','["3x10^8 m/s","3x10^5 m/s","3x10^6 m/s","3x10^10 m/s"]','3x10^8 m/s',null),
('science','easy','Which organ pumps blood through the body?','["Liver","Lungs","Heart","Kidney"]','Heart',null),
('science','easy','Water freezes at…','["0 C","10 C","32 C","100 C"]','0 C',null),
('science','easy','Chemical symbol of sodium?','["S","So","Na","Sn"]','Na',null),
('science','easy','Which planet is closest to the Sun?','["Venus","Mercury","Mars","Earth"]','Mercury',null),
('science','medium','Energy stored in a stretched spring is…','["Kinetic","Thermal","Potential","Nuclear"]','Potential',null),
('science','easy','DNA carries…','["Genetic information","Oxygen","Fat","Minerals"]','Genetic information',null),
('science','medium','Acceleration due to gravity on Earth is about','["4.9 m/s2","9.8 m/s2","19.6 m/s2","1.6 m/s2"]','9.8 m/s2',null),
('science','easy','Sound cannot travel through…','["Steel","Water","Air","Vacuum"]','Vacuum',null),
('science','easy','Which particle has a negative charge?','["Proton","Neutron","Electron","Photon"]','Electron',null),
('science','easy','Unit of electric current?','["Volt","Ampere","Ohm","Watt"]','Ampere',null),
('science','medium','The powerhouse of the cell is the…','["Nucleus","Ribosome","Mitochondrion","Vacuole"]','Mitochondrion',null),
('science','easy','Pure water has a pH of about…','["3","7","9","12"]','7',null),
('math','easy','17 + 28 = ?',null,'45',null),
('math','easy','64 - 29 = ?',null,'35',null),
('math','easy','12 x 7 = ?',null,'84',null),
('math','medium','13 x 14 = ?',null,'182',null),
('math','medium','24 x 16 = ?',null,'384',null),
('math','medium','3x + 12 = 39. x = ?',null,'9',null),
('math','medium','7x - 5 = 44. x = ?',null,'7',null),
('math','hard','(28 x 9) - 37 = ?',null,'215',null),
('math','hard','(45 x 12) - 68 = ?',null,'472',null),
('math','hard','19 x 23 = ?',null,'437',null),
('math','medium','144 / 12 = ?',null,'12',null),
('math','medium','15% of 240 = ?',null,'36',null),
('math','hard','(17 x 18) + 26 = ?',null,'332',null),
('math','easy','56 + 37 = ?',null,'93',null),
('math','hard','5x + 23 = 118. x = ?',null,'19',null);