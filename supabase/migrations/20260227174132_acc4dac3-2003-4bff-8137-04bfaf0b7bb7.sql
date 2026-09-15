
-- Add referral columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referral_code text UNIQUE,
  ADD COLUMN IF NOT EXISTS referred_by uuid REFERENCES public.profiles(id);

-- Create referrals table
CREATE TABLE public.referrals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_id uuid NOT NULL REFERENCES public.profiles(id),
  referral_code text NOT NULL UNIQUE,
  successful_signups integer NOT NULL DEFAULT 0,
  priority_boost_expiry timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own referral" ON public.referrals
  FOR SELECT USING (auth.uid() = referrer_id);

CREATE POLICY "Users can insert own referral" ON public.referrals
  FOR INSERT WITH CHECK (auth.uid() = referrer_id);

CREATE POLICY "Users can update own referral" ON public.referrals
  FOR UPDATE USING (auth.uid() = referrer_id);

-- Create notifications table
CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  message text NOT NULL,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- Allow anon to read referrals by code (for /join/:code validation)
CREATE POLICY "Anyone can verify referral codes" ON public.referrals
  FOR SELECT USING (true);

-- Allow profiles to be read by referral code lookup (limited via function)
-- We need a security definer function to look up referrer by code
CREATE OR REPLACE FUNCTION public.lookup_referral_code(_code text)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object('referrer_id', r.referrer_id, 'valid', true)
  FROM referrals r
  WHERE r.referral_code = _code
  LIMIT 1;
$$;

-- Function to process referral on signup (called from edge function)
CREATE OR REPLACE FUNCTION public.process_referral(_new_user_id uuid, _referral_code text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _referrer_id uuid;
BEGIN
  SELECT referrer_id INTO _referrer_id
  FROM referrals
  WHERE referral_code = _referral_code;

  IF _referrer_id IS NULL THEN RETURN; END IF;
  IF _referrer_id = _new_user_id THEN RETURN; END IF;

  -- Set referred_by
  UPDATE profiles SET referred_by = _referrer_id WHERE id = _new_user_id;

  -- Increment successful signups
  UPDATE referrals SET successful_signups = successful_signups + 1
  WHERE referral_code = _referral_code;

  -- Grant 30-day priority boost
  UPDATE referrals SET priority_boost_expiry = now() + interval '30 days'
  WHERE referral_code = _referral_code;

  -- Boost referrer quality score by 1.2x
  UPDATE profiles SET quality_score = LEAST(quality_score * 1.2, 5.0)
  WHERE id = _referrer_id;

  -- Create notification
  INSERT INTO notifications (user_id, message)
  VALUES (_referrer_id, 'A friend just joined using your referral link! 🎉');
END;
$$;
