-- toto-wc26 / migration 0003
-- pg_cron schedule for the sync-fixtures Edge Function.
--
-- Runs every 20 minutes between 10:00 and 02:00 UTC (covers all WC2026
-- match windows from Mexico City to Asia time zones).
--
-- The Edge Function itself checks for active matches before calling
-- API-Football, so idle calls are cheap (~1ms, no external API hit).
--
-- ═══════════════════════════════════════════════════════════════════
-- IMPORTANT: Before applying this migration, ensure:
--   1. pg_cron and pg_net extensions are enabled in your Supabase project
--      (Database → Extensions → search "pg_cron" and "pg_net" → Enable).
--   2. The Edge Function `sync-fixtures` is deployed:
--      `supabase functions deploy sync-fixtures`
--   3. The API_FOOTBALL_KEY secret is set:
--      `supabase secrets set API_FOOTBALL_KEY=your-key`
--   4. Replace <YOUR_PROJECT_REF> below with your actual project ref
--      (e.g. zxexfeihapgecttjtsbu).
-- ═══════════════════════════════════════════════════════════════════

-- Enable required extensions (idempotent).
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- Schedule: every 20 min during match windows (10:00–23:59 and 00:00–02:00 UTC).
-- Cron expression: */20 0-2,10-23 * 6-7 *
-- (every 20 min, hours 0-2 and 10-23, any day, June-July only)
--
-- NOTE: If your tournament extends beyond July (WC2026 final is July 19),
-- adjust the month range as needed.

select cron.schedule(
  'sync-fixtures-every-20m',
  '*/20 0-2,10-23 * 6-7 *',
  $$
    select net.http_post(
      url := 'https://zxexfeihapgecttjtsbu.supabase.co/functions/v1/sync-fixtures',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('supabase.service_role_key', true)
      ),
      body := '{}'::jsonb
    );
  $$
);
