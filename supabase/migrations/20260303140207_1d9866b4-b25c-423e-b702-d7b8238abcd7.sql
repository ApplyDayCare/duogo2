-- Drop the overly permissive policy that exposes all referral data to anyone
DROP POLICY IF EXISTS "Anyone can verify referral codes" ON public.referrals;