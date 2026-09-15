
-- Reports table
CREATE TABLE public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES public.profiles(id),
  reported_user_id uuid NOT NULL REFERENCES public.profiles(id),
  match_id uuid REFERENCES public.matches(id),
  reason text NOT NULL,
  details text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by text
);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own reports" ON public.reports
  FOR INSERT WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Users can view own reports" ON public.reports
  FOR SELECT USING (auth.uid() = reporter_id);

-- Blocks table
CREATE TABLE public.blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id uuid NOT NULL REFERENCES public.profiles(id),
  blocked_user_id uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(blocker_id, blocked_user_id)
);

ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own blocks" ON public.blocks
  FOR INSERT WITH CHECK (auth.uid() = blocker_id);

CREATE POLICY "Users can view own blocks" ON public.blocks
  FOR SELECT USING (auth.uid() = blocker_id);

CREATE POLICY "Users can delete own blocks" ON public.blocks
  FOR DELETE USING (auth.uid() = blocker_id);

-- Suspension columns on profiles
ALTER TABLE public.profiles
  ADD COLUMN is_suspended boolean NOT NULL DEFAULT false,
  ADD COLUMN suspension_reason text,
  ADD COLUMN suspended_at timestamptz;

-- Auto-suspension function: suspend user after 3+ reports
CREATE OR REPLACE FUNCTION public.check_auto_suspend()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  report_count integer;
BEGIN
  SELECT COUNT(*) INTO report_count
  FROM reports
  WHERE reported_user_id = NEW.reported_user_id
    AND status != 'dismissed';

  IF report_count >= 3 THEN
    UPDATE profiles
    SET is_suspended = true,
        suspension_reason = 'Multiple user reports',
        suspended_at = now(),
        matching_paused = true
    WHERE id = NEW.reported_user_id;

    INSERT INTO notifications (user_id, message)
    VALUES (NEW.reported_user_id, 'Your account has been temporarily suspended due to multiple reports. We are reviewing your account.');
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER check_auto_suspend_trigger
  AFTER INSERT ON public.reports
  FOR EACH ROW
  EXECUTE FUNCTION public.check_auto_suspend();
