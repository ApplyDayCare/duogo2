CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

SELECT cron.unschedule('notify-new-matches-daily')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'notify-new-matches-daily');

SELECT cron.schedule(
  'notify-new-matches-daily',
  '0 16 * * *',
  $$
  SELECT net.http_post(
    url := 'https://hdbobqzqsmmsnzbjtzbn.supabase.co/functions/v1/notify-new-matches',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhkYm9icXpxc21tc256Ymp0emJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxMTY3NDQsImV4cCI6MjA4NzY5Mjc0NH0.U_lS4-1zpd36SR4xxGDdXSBfM3408wv4pRbfDGUbQ4k"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);