
-- Add quiz_completed to profiles
ALTER TABLE public.profiles ADD COLUMN quiz_completed boolean NOT NULL DEFAULT false;

-- Create quiz_responses table
CREATE TABLE public.quiz_responses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  couple_id uuid REFERENCES public.couples(id) ON DELETE SET NULL,
  dimension_1_social integer NOT NULL,
  dimension_2_budget integer NOT NULL,
  dimension_3_spontaneity integer NOT NULL,
  dimension_4_planning integer NOT NULL,
  dimension_5_intellectual integer NOT NULL,
  dimension_6_activity integer NOT NULL,
  dimension_7_alcohol integer NOT NULL,
  dimension_8_humor integer NOT NULL,
  dimension_9_commitment integer NOT NULL,
  dimension_10_home integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dim1_range CHECK (dimension_1_social BETWEEN 1 AND 5),
  CONSTRAINT dim2_range CHECK (dimension_2_budget BETWEEN 1 AND 5),
  CONSTRAINT dim3_range CHECK (dimension_3_spontaneity BETWEEN 1 AND 5),
  CONSTRAINT dim4_range CHECK (dimension_4_planning BETWEEN 1 AND 5),
  CONSTRAINT dim5_range CHECK (dimension_5_intellectual BETWEEN 1 AND 5),
  CONSTRAINT dim6_range CHECK (dimension_6_activity BETWEEN 1 AND 5),
  CONSTRAINT dim7_range CHECK (dimension_7_alcohol BETWEEN 1 AND 5),
  CONSTRAINT dim8_range CHECK (dimension_8_humor BETWEEN 1 AND 5),
  CONSTRAINT dim9_range CHECK (dimension_9_commitment BETWEEN 1 AND 5),
  CONSTRAINT dim10_range CHECK (dimension_10_home BETWEEN 1 AND 5)
);

-- Enable RLS
ALTER TABLE public.quiz_responses ENABLE ROW LEVEL SECURITY;

-- Users can view their own responses
CREATE POLICY "Users can view own quiz responses"
  ON public.quiz_responses FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own responses
CREATE POLICY "Users can insert own quiz responses"
  ON public.quiz_responses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own responses
CREATE POLICY "Users can update own quiz responses"
  ON public.quiz_responses FOR UPDATE
  USING (auth.uid() = user_id);
