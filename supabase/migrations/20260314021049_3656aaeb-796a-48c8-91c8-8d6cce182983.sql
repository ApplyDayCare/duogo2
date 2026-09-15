ALTER TABLE public.matches
  DROP CONSTRAINT IF EXISTS matches_status_check;

ALTER TABLE public.matches
  ADD CONSTRAINT matches_status_check
  CHECK (status IN ('pending', 'mutual', 'passed_by_a', 'passed_by_b', 'expired', 'blocked'));