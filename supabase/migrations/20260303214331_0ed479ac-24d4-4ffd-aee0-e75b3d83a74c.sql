CREATE POLICY "Users can delete own quiz responses"
  ON public.quiz_responses FOR DELETE
  USING (auth.uid() = user_id);