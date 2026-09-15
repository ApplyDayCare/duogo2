
-- Drop the existing permissive update policy
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- Create a restricted update policy that prevents modification of admin-managed fields
-- Uses WITH CHECK to ensure protected fields remain unchanged after update
CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
  AND is_suspended = (SELECT p.is_suspended FROM public.profiles p WHERE p.id = auth.uid())
  AND suspended_at IS NOT DISTINCT FROM (SELECT p.suspended_at FROM public.profiles p WHERE p.id = auth.uid())
  AND suspension_reason IS NOT DISTINCT FROM (SELECT p.suspension_reason FROM public.profiles p WHERE p.id = auth.uid())
  AND quality_score = (SELECT p.quality_score FROM public.profiles p WHERE p.id = auth.uid())
);
