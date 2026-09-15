
-- Create couple_vectors table for storing calculated min/max ranges
CREATE TABLE public.couple_vectors (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  couple_id uuid NOT NULL REFERENCES public.couples(id) UNIQUE,
  d1_min integer, d1_max integer,
  d2_min integer, d2_max integer,
  d3_min integer, d3_max integer,
  d4_min integer, d4_max integer,
  d5_min integer, d5_max integer,
  d6_min integer, d6_max integer,
  d7_min integer, d7_max integer,
  d8_min integer, d8_max integer,
  d9_min integer, d9_max integer,
  d10_min integer, d10_max integer,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.couple_vectors ENABLE ROW LEVEL SECURITY;

-- RLS: members of the couple can view/insert/update their vectors
CREATE OR REPLACE FUNCTION public.is_couple_member(_couple_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.couples
    WHERE id = _couple_id
      AND (partner_a_id = auth.uid() OR partner_b_id = auth.uid())
  );
$$;

CREATE POLICY "Couple members can view vectors"
  ON public.couple_vectors FOR SELECT
  USING (public.is_couple_member(couple_id));

CREATE POLICY "Couple members can insert vectors"
  ON public.couple_vectors FOR INSERT
  WITH CHECK (public.is_couple_member(couple_id));

CREATE POLICY "Couple members can update vectors"
  ON public.couple_vectors FOR UPDATE
  USING (public.is_couple_member(couple_id));

-- Create matches table
CREATE TABLE public.matches (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_a_id uuid NOT NULL REFERENCES public.profiles(id),
  user_b_id uuid NOT NULL REFERENCES public.profiles(id),
  compatibility_score decimal NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'mutual', 'passed_by_a', 'passed_by_b', 'expired')),
  user_a_action text CHECK (user_a_action IN ('accept', 'pass')),
  user_b_action text CHECK (user_b_action IN ('accept', 'pass')),
  revealed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_a_id, user_b_id)
);

ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own matches"
  ON public.matches FOR SELECT
  USING (auth.uid() = user_a_id OR auth.uid() = user_b_id);

CREATE POLICY "Users can insert matches"
  ON public.matches FOR INSERT
  WITH CHECK (auth.uid() = user_a_id OR auth.uid() = user_b_id);

CREATE POLICY "Users can update own matches"
  ON public.matches FOR UPDATE
  USING (auth.uid() = user_a_id OR auth.uid() = user_b_id);
