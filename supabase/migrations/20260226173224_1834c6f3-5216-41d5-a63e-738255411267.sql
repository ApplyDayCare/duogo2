
-- Add quality_score to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS quality_score numeric NOT NULL DEFAULT 1.0;

-- Create pulse_feedback table
CREATE TABLE public.pulse_feedback (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id uuid NOT NULL REFERENCES public.matches(id),
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  met_in_person text NOT NULL CHECK (met_in_person IN ('yes', 'planning', 'no')),
  rating integer CHECK (rating BETWEEN 1 AND 5),
  activities text[],
  activity_other text,
  want_more_matches boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(match_id, user_id)
);

ALTER TABLE public.pulse_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own feedback" ON public.pulse_feedback
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own feedback" ON public.pulse_feedback
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.matches
      WHERE id = match_id AND (user_a_id = auth.uid() OR user_b_id = auth.uid())
    )
  );
