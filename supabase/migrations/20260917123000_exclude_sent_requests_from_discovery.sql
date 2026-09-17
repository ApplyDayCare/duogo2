-- Migration: 20260917123000_exclude_sent_requests_from_discovery.sql
-- Description: Exclude users who have already received a connection request from current user (or partner) from candidate discovery

CREATE OR REPLACE FUNCTION public.get_candidate_matches()
RETURNS TABLE (
  id uuid,
  first_name text,
  user_type text,
  location_city text,
  travel_radius_km integer,
  dimensions jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _my_user_type text;
  _my_id uuid := auth.uid();
  _my_quiz_completed boolean;
  _my_onboarding_completed boolean;
  _my_has_partner boolean := false;
  _partner_id uuid := NULL;
BEGIN
  IF _my_id IS NULL THEN
    RETURN;
  END IF;

  SELECT p.user_type, p.quiz_completed, p.onboarding_completed
  INTO _my_user_type, _my_quiz_completed, _my_onboarding_completed
  FROM profiles p
  WHERE p.id = _my_id;

  -- 1. If caller hasn't completed quiz or onboarding, return NO matches
  IF _my_quiz_completed IS NOT TRUE OR _my_onboarding_completed IS NOT TRUE THEN
    RETURN;
  END IF;

  -- 2. If caller is a couple, verify caller has a partner linked in couples
  IF _my_user_type = 'couple' THEN
    SELECT 
      EXISTS (
        SELECT 1 FROM couples c
        WHERE (c.partner_a_id = _my_id OR c.partner_b_id = _my_id)
          AND c.partner_b_id IS NOT NULL
      ),
      CASE
        WHEN c.partner_a_id = _my_id THEN c.partner_b_id
        ELSE c.partner_a_id
      END
    INTO _my_has_partner, _partner_id
    FROM couples c
    WHERE (c.partner_a_id = _my_id OR c.partner_b_id = _my_id)
      AND c.partner_b_id IS NOT NULL
    LIMIT 1;

    -- If couple has no partner linked yet, return NO matches
    IF NOT _my_has_partner THEN
      RETURN;
    END IF;
  END IF;

  -- 3. Return candidate matches excluding:
  -- - Current user and partner
  -- - Users who have already received a connection request from current user or partner
  -- - Users with whom a match is already mutual, passed, pending, or blocked
  RETURN QUERY
  SELECT 
    p.id,
    p.first_name,
    p.user_type,
    p.location_city,
    p.travel_radius_km,
    jsonb_build_object(
      'dimension_1_social', q.dimension_1_social,
      'dimension_2_budget', q.dimension_2_budget,
      'dimension_3_spontaneity', q.dimension_3_spontaneity,
      'dimension_4_planning', q.dimension_4_planning,
      'dimension_5_intellectual', q.dimension_5_intellectual,
      'dimension_6_activity', q.dimension_6_activity,
      'dimension_7_alcohol', q.dimension_7_alcohol,
      'dimension_8_humor', q.dimension_8_humor,
      'dimension_9_commitment', q.dimension_9_commitment,
      'dimension_10_home', q.dimension_10_home
    ) AS dimensions
  FROM profiles p
  LEFT JOIN quiz_responses q ON q.user_id = p.id
  WHERE p.id <> _my_id
    AND (_partner_id IS NULL OR p.id <> _partner_id)
    AND p.quiz_completed = true
    AND p.onboarding_completed = true
    AND (p.is_suspended IS NULL OR p.is_suspended = false)
    AND (p.matching_paused IS NULL OR p.matching_paused = false)
    AND (
      -- Solo with Solo
      (_my_user_type = 'solo' AND (p.user_type = 'solo' OR p.user_type IS NULL))
      OR
      -- Couple with Couple (only fully linked & verified couples)
      (_my_user_type = 'couple' AND p.user_type = 'couple' AND EXISTS (
        SELECT 1 FROM couples c
        JOIN profiles pa ON pa.id = c.partner_a_id
        JOIN profiles pb ON pb.id = c.partner_b_id
        WHERE (c.partner_a_id = p.id OR c.partner_b_id = p.id)
          AND c.partner_b_id IS NOT NULL
          AND pa.quiz_completed = true
          AND pb.quiz_completed = true
      ))
    )
    AND p.id NOT IN (
      -- Exclude where current user or partner was user_a and initiated/sent request or status is resolved/pending
      SELECT m.user_b_id FROM matches m 
      WHERE (m.user_a_id = _my_id OR (_partner_id IS NOT NULL AND m.user_a_id = _partner_id))
        AND (m.status IN ('passed_by_a', 'passed_by_b', 'mutual', 'blocked', 'pending') OR m.user_a_action = 'accept')
      UNION
      -- Exclude where current user or partner was user_b and initiated/sent request or status is resolved/pending
      SELECT m.user_a_id FROM matches m 
      WHERE (m.user_b_id = _my_id OR (_partner_id IS NOT NULL AND m.user_b_id = _partner_id))
        AND (m.status IN ('passed_by_a', 'passed_by_b', 'mutual', 'blocked', 'pending') OR m.user_b_action = 'accept')
    )
  LIMIT 25;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_candidate_matches() TO authenticated;
