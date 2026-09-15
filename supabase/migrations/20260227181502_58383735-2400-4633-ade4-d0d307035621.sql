
-- Allow admin to read all reports via service role (the edge function uses service role)
-- Add policy so the admin page can read reports via an edge function
-- Also add an admin-level SELECT policy for reports
CREATE POLICY "Service role can read all reports" ON public.reports
  FOR SELECT USING (true);

-- Drop the restrictive user-only policy and replace with permissive
DROP POLICY IF EXISTS "Users can view own reports" ON public.reports;
CREATE POLICY "Users can view own reports" ON public.reports
  FOR SELECT USING (auth.uid() = reporter_id);
