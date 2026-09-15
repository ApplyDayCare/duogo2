
CREATE OR REPLACE FUNCTION public.process_referral(_new_user_id uuid, _referral_code text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _referrer_id uuid;
BEGIN
  -- Validate caller is processing their own referral
  IF _new_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized: can only process own referral';
  END IF;

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
