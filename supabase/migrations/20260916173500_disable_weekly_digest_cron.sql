-- Disable weekly match digest cron job
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('weekly-match-digest');
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;
