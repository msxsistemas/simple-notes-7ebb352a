-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Schedule auto-notify-clients to run every hour
-- The edge function itself checks the configured notification hour per user
SELECT cron.schedule(
  'auto-notify-clients-hourly',
  '0 * * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://dxxfablfqigoewcfmjzl.supabase.co/functions/v1/auto-notify-clients',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR4eGZhYmxmcWlnb2V3Y2ZtanpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwMjUzODcsImV4cCI6MjA3MDYwMTM4N30.KKHtm7Cx_1vba7KHC_GWy0UmKEezI7K7GyLeSR2-vio"}'::jsonb,
      body := concat('{"time": "', now(), '"}')::jsonb
    ) AS request_id;
  $$
);
