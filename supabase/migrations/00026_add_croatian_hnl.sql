-- Eksakt — add the Croatian top flight (HNL) as a trackable competition.
--
-- football-data.org now serves Croatia's first league under code PRVA
-- (competition id 2047, API name "Prva Liga", type LEAGUE, area HRV).
-- Verified 2026-09-21 against /v4/competitions/PRVA: current season
-- 2026-08-01 → 2027-05-22, 10 teams, 36 matchdays, every match staged
-- REGULAR_SEASON — so the LEAGUE branch of deriveRound() ("Matchday N")
-- applies unchanged and no edge-function change is needed.
--
-- Three pieces, mirroring how the six European comps were wired up
-- (competition row: docs/SETUP.md §4; cron jobs: 00008):
--   1. the competitions row both sync functions look up by code;
--   2. smart-gated 30s live polling — should_poll_live_matches gates the
--      HTTP call, so days without a match cost no API requests;
--   3. the daily fixture refresh at 03:35 UTC, the next free 5-minute slot
--      after CL at 03:30, so we never hit football-data.org concurrently.
--
-- The first import is NOT automatic. After applying, run once:
--   select public.dispatch_sync_fixtures('PRVA');
--
-- Idempotent: the insert skips if PRVA already exists; cron.schedule
-- upserts by job name.

insert into public.competitions
  (name, code, type, season_start, season_end, api_external_id)
values
  ('HNL 2026/27', 'PRVA', 'LEAGUE', '2026-08-01', '2027-05-22', 2047)
on conflict (code) do nothing;

select cron.schedule(
  'eksakt-sync-live-prva',
  '30 seconds',
  $cron$ select public.dispatch_sync_live_matches('PRVA'); $cron$
);

select cron.schedule(
  'eksakt-sync-fixtures-prva',
  '35 3 * * *',
  $cron$ select public.dispatch_sync_fixtures('PRVA'); $cron$
);
