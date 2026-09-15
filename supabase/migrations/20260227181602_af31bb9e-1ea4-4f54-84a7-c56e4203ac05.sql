
-- Remove overly permissive policy
DROP POLICY IF EXISTS "Service role can read all reports" ON public.reports;
