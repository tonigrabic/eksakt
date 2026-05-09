-- Eksakt — extensions for scheduled jobs and HTTP calls.
--
-- pg_cron schedules the sync-live-matches Edge Function during match windows.
-- pg_net lets pg_cron's job body POST to the Edge Function URL.
--
-- Both are pre-installed in Supabase Postgres images; we just need to
-- create them in the conventional schemas.

create extension if not exists pg_cron with schema cron;
create extension if not exists pg_net with schema extensions;

-- pg_cron jobs run as the postgres superuser. We need it to be able to
-- call functions in `public` (e.g. our smart-gate that checks whether to
-- poll right now).
grant usage on schema cron to postgres;
