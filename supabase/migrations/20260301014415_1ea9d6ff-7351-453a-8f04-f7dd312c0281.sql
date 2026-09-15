-- Performance indexes for matching queries
CREATE INDEX IF NOT EXISTS idx_profiles_location ON public.profiles(location_city);
CREATE INDEX IF NOT EXISTS idx_profiles_user_type ON public.profiles(user_type);
CREATE INDEX IF NOT EXISTS idx_profiles_matching ON public.profiles(is_suspended, matching_paused, quiz_completed, onboarding_completed);
CREATE INDEX IF NOT EXISTS idx_quiz_responses_user ON public.quiz_responses(user_id);
CREATE INDEX IF NOT EXISTS idx_matches_status ON public.matches(status);
CREATE INDEX IF NOT EXISTS idx_matches_users ON public.matches(user_a_id, user_b_id);
CREATE INDEX IF NOT EXISTS idx_matches_user_a ON public.matches(user_a_id);
CREATE INDEX IF NOT EXISTS idx_matches_user_b ON public.matches(user_b_id);
CREATE INDEX IF NOT EXISTS idx_couples_partner_a ON public.couples(partner_a_id);
CREATE INDEX IF NOT EXISTS idx_couples_partner_b ON public.couples(partner_b_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_reports_reported_user ON public.reports(reported_user_id, status);
CREATE INDEX IF NOT EXISTS idx_pulse_feedback_match ON public.pulse_feedback(match_id, user_id);