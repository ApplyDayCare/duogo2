
-- Create a helper function that checks if auth.uid() can view a match
-- (either direct participant or couple partner of a participant)
CREATE OR REPLACE FUNCTION public.is_match_viewer(_match_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.matches m
    WHERE m.id = _match_id
      AND (
        m.user_a_id = auth.uid() OR m.user_b_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.couples c
          WHERE (c.partner_a_id = m.user_a_id OR c.partner_b_id = m.user_a_id)
            AND (c.partner_a_id = auth.uid() OR c.partner_b_id = auth.uid())
        )
        OR EXISTS (
          SELECT 1 FROM public.couples c
          WHERE (c.partner_a_id = m.user_b_id OR c.partner_b_id = m.user_b_id)
            AND (c.partner_a_id = auth.uid() OR c.partner_b_id = auth.uid())
        )
      )
  );
$$;

-- Also create a helper to get the partner ID for the current user (or null)
CREATE OR REPLACE FUNCTION public.get_couple_partner_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE 
    WHEN c.partner_a_id = auth.uid() THEN c.partner_b_id
    ELSE c.partner_a_id
  END
  FROM public.couples c
  WHERE c.partner_a_id = auth.uid() OR c.partner_b_id = auth.uid()
  LIMIT 1;
$$;

-- Drop existing matches SELECT policy and replace with couple-aware one
DROP POLICY IF EXISTS "Users can view own matches" ON public.matches;
CREATE POLICY "Users can view own matches"
  ON public.matches FOR SELECT
  TO public
  USING (is_match_viewer(id));

-- Drop and recreate UPDATE policy to be couple-aware
DROP POLICY IF EXISTS "Users can update own match action" ON public.matches;
CREATE POLICY "Users can update own match action"
  ON public.matches FOR UPDATE
  TO authenticated
  USING (is_match_viewer(id))
  WITH CHECK (
    -- Only the direct participant or their couple partner can update
    is_match_viewer(id)
    AND (
      -- Existing constraints to prevent changing other fields
      compatibility_score = (SELECT m.compatibility_score FROM matches m WHERE m.id = matches.id)
      AND NOT (revealed_at IS DISTINCT FROM (SELECT m.revealed_at FROM matches m WHERE m.id = matches.id))
      AND status = (SELECT m.status FROM matches m WHERE m.id = matches.id)
      AND user_a_id = (SELECT m.user_a_id FROM matches m WHERE m.id = matches.id)
      AND user_b_id = (SELECT m.user_b_id FROM matches m WHERE m.id = matches.id)
    )
  );

-- Drop and recreate DELETE policy to be couple-aware
DROP POLICY IF EXISTS "Users can delete own matches" ON public.matches;
CREATE POLICY "Users can delete own matches"
  ON public.matches FOR DELETE
  TO public
  USING (is_match_viewer(id));
