-- Eksakt — extend cron schedule to the 6 European competitions.
--
-- Same pattern as 00007_cron.sql: smart-gated 30s live polling + daily
-- fixture refresh. Daily fixture jobs are staggered by 5 minutes so
-- they never hit football-data.org concurrently (Free tier = 10 req/min,
-- Livescores = 20 req/min — either way we're safe).
--
-- Live polling at 30s assumes Livescores plan. On Free tier the live
-- score data is delayed ~90 min so the cron still runs but the data
-- you'll see is stale; nothing here breaks. Smart-gate ensures we don't
-- burn API calls on competitions with no live or imminent matches.

-- ── Live polling (every 30s, smart-gated) ────────────────────────────────────

select cron.schedule(
  'eksakt-sync-live-cl',
  '30 seconds',
  $cron$ select public.dispatch_sync_live_matches('CL'); $cron$
);

select cron.schedule(
  'eksakt-sync-live-bl1',
  '30 seconds',
  $cron$ select public.dispatch_sync_live_matches('BL1'); $cron$
);

select cron.schedule(
  'eksakt-sync-live-pd',
  '30 seconds',
  $cron$ select public.dispatch_sync_live_matches('PD'); $cron$
);

select cron.schedule(
  'eksakt-sync-live-fl1',
  '30 seconds',
  $cron$ select public.dispatch_sync_live_matches('FL1'); $cron$
);

select cron.schedule(
  'eksakt-sync-live-sa',
  '30 seconds',
  $cron$ select public.dispatch_sync_live_matches('SA'); $cron$
);

select cron.schedule(
  'eksakt-sync-live-pl',
  '30 seconds',
  $cron$ select public.dispatch_sync_live_matches('PL'); $cron$
);

-- ── Daily fixture refresh (staggered by 5 min) ──────────────────────────────

select cron.schedule(
  'eksakt-sync-fixtures-pl',
  '5 3 * * *',
  $cron$ select public.dispatch_sync_fixtures('PL'); $cron$
);

select cron.schedule(
  'eksakt-sync-fixtures-pd',
  '10 3 * * *',
  $cron$ select public.dispatch_sync_fixtures('PD'); $cron$
);

select cron.schedule(
  'eksakt-sync-fixtures-bl1',
  '15 3 * * *',
  $cron$ select public.dispatch_sync_fixtures('BL1'); $cron$
);

select cron.schedule(
  'eksakt-sync-fixtures-sa',
  '20 3 * * *',
  $cron$ select public.dispatch_sync_fixtures('SA'); $cron$
);

select cron.schedule(
  'eksakt-sync-fixtures-fl1',
  '25 3 * * *',
  $cron$ select public.dispatch_sync_fixtures('FL1'); $cron$
);

select cron.schedule(
  'eksakt-sync-fixtures-cl',
  '30 3 * * *',
  $cron$ select public.dispatch_sync_fixtures('CL'); $cron$
);
