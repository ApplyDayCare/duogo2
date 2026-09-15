-- Migration: Enable candidate discovery for matches
-- 1. Security Definer RPC function that returns candidate profiles for the authenticated user
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
BEGIN
  IF _my_id IS NULL THEN
    RETURN;
  END IF;

  SELECT p.user_type INTO _my_user_type
  FROM profiles p
  WHERE p.id = _my_id;

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
    AND p.quiz_completed = true
    AND (p.is_suspended IS NULL OR p.is_suspended = false)
    AND (p.matching_paused IS NULL OR p.matching_paused = false)
    AND (
      _my_user_type IS NULL 
      OR p.user_type = _my_user_type 
      OR (_my_user_type = 'solo' AND (p.user_type = 'solo' OR p.user_type IS NULL))
    )
    AND p.id NOT IN (
      SELECT m.user_b_id FROM matches m WHERE m.user_a_id = _my_id AND m.status IN ('passed_by_a', 'passed_by_b', 'mutual', 'blocked')
      UNION
      SELECT m.user_a_id FROM matches m WHERE m.user_b_id = _my_id AND m.status IN ('passed_by_a', 'passed_by_b', 'mutual', 'blocked')
    )
  LIMIT 25;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_candidate_matches() TO authenticated;

-- 2. Ensure RLS policies allow authenticated users to view candidate profiles & quiz responses
DROP POLICY IF EXISTS "Allow members to view candidate profiles" ON public.profiles;
CREATE POLICY "Allow members to view candidate profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    quiz_completed = true 
    AND (is_suspended IS NULL OR is_suspended = false)
    AND (matching_paused IS NULL OR matching_paused = false)
  );

DROP POLICY IF EXISTS "Allow members to view candidate quiz responses" ON public.quiz_responses;
CREATE POLICY "Allow members to view candidate quiz responses"
  ON public.quiz_responses
  FOR SELECT
  TO authenticated
  USING (true);
