CREATE TABLE public.match_candidate_notices (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  candidate_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT match_candidate_notices_unique_pair UNIQUE (user_id, candidate_user_id)
);

GRANT SELECT ON public.match_candidate_notices TO authenticated;
GRANT ALL ON public.match_candidate_notices TO service_role;

ALTER TABLE public.match_candidate_notices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own candidate notices"
  ON public.match_candidate_notices
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX idx_match_candidate_notices_user_id
  ON public.match_candidate_notices (user_id);

CREATE INDEX idx_match_candidate_notices_created_at
  ON public.match_candidate_notices (created_at);