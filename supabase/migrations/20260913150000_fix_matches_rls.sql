-- Drop existing recursive matches policies and replace with clean, non-recursive ones
DROP POLICY IF EXISTS "Users can view own matches" ON public.matches;
DROP POLICY IF EXISTS "Users can update own match action" ON public.matches;
DROP POLICY IF EXISTS "Users can delete own matches" ON public.matches;

-- 1. Non-recursive SELECT policy for public.matches
CREATE POLICY "Users can view own matches"
  ON public.matches FOR SELECT
  TO public
  USING (
    user_a_id = auth.uid() OR user_b_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.couples c
      WHERE (c.partner_a_id = user_a_id OR c.partner_b_id = user_a_id)
        AND (c.partner_a_id = auth.uid() OR c.partner_b_id = auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.couples c
      WHERE (c.partner_a_id = user_b_id OR c.partner_b_id = user_b_id)
        AND (c.partner_a_id = auth.uid() OR c.partner_b_id = auth.uid())
    )
  );

-- 2. Non-recursive UPDATE policy for public.matches
CREATE POLICY "Users can update own match action"
  ON public.matches FOR UPDATE
  TO authenticated
  USING (
    user_a_id = auth.uid() OR user_b_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.couples c
      WHERE (c.partner_a_id = user_a_id OR c.partner_b_id = user_a_id)
        AND (c.partner_a_id = auth.uid() OR c.partner_b_id = auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.couples c
      WHERE (c.partner_a_id = user_b_id OR c.partner_b_id = user_b_id)
        AND (c.partner_a_id = auth.uid() OR c.partner_b_id = auth.uid())
    )
  );

-- 3. Non-recursive DELETE policy for public.matches
CREATE POLICY "Users can delete own matches"
  ON public.matches FOR DELETE
  TO public
  USING (
    user_a_id = auth.uid() OR user_b_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.couples c
      WHERE (c.partner_a_id = user_a_id OR c.partner_b_id = user_a_id)
        AND (c.partner_a_id = auth.uid() OR c.partner_b_id = auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.couples c
      WHERE (c.partner_a_id = user_b_id OR c.partner_b_id = user_b_id)
        AND (c.partner_a_id = auth.uid() OR c.partner_b_id = auth.uid())
    )
  );
