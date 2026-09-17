-- Migration: Reset onboarding_completed and quiz_completed for profiles lacking quiz_responses
-- Description: Resets onboarding_completed and quiz_completed to false for any profile where quiz_completed
-- is true but no matching row exists in public.quiz_responses.
-- Profiles with a legitimate quiz_responses row are not touched.

DO $$
DECLARE
  v_affected_count integer := 0;
BEGIN
  WITH updated_rows AS (
    UPDATE public.profiles p
    SET 
      onboarding_completed = false,
      quiz_completed = false
    WHERE p.quiz_completed = true
      AND NOT EXISTS (
        SELECT 1 
        FROM public.quiz_responses qr 
        WHERE qr.user_id = p.id
      )
    RETURNING p.id
  )
  SELECT COUNT(*) INTO v_affected_count FROM updated_rows;

  RAISE NOTICE 'Migration 20260917170000_reset_incomplete_quiz_profiles: Reset onboarding_completed and quiz_completed to false for % profile(s) lacking quiz_responses.', v_affected_count;
END $$;
