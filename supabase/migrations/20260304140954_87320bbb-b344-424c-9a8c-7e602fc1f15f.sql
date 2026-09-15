CREATE POLICY "Users can delete own matches"
  ON public.matches FOR DELETE
  USING (auth.uid() = user_a_id OR auth.uid() = user_b_id);