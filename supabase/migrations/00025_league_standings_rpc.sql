-- Eksakt — server-side league standings aggregation.
--
-- Problem: the client rebuilt every league's leaderboard from the full
-- prediction set on each read. getDashboard, getMyLeagues, getLeagueDetail,
-- getMatchDetail and getPredictionContext all called fetchPredictionsForLeague
-- + computeStandings — an O(members × matches) pull that grows all season. A
-- World Cup pool already fetched ~1,300 rows to render a 23-row table, brushing
-- against PostgREST's max-rows cap (the reason that fetch had to be paginated
-- in the first place — see commit 6148cd0).
--
-- Fix: aggregate the finished half in Postgres. Points for finished matches are
-- frozen in public.points by compute_points_for_match, which runs in the SAME
-- transaction as the matches.status → 'finished' flip (see the AFTER trigger in
-- 00006). So a match that reads as finished always has its points committed —
-- SUM(points.total) is exact and complete, never racing the trigger. One row
-- per member:
--   • finished_points — SUM(points.total) over the member's finished picks
--   • exact_scores    — COUNT of those with base_points = 4 (the tiebreaker)
--   • boosters_x2/3/5 — booster usage counts (remaining = pool − used)
--
-- The client overlays ONLY currently-live matches (predictions for live matches
-- × members — small and bounded) to add provisional matchday points with the
-- same TS scorer. Scheduled matches contribute nothing to standings.
--
-- Visibility: SECURITY DEFINER (must read across all members to aggregate),
-- guarded by an explicit is_league_member check so only a league's own members
-- can read its board — mirroring the points_select_member RLS the definer
-- bypasses. Booster counts honor the blind-prediction rule: you always see your
-- own boosters, but another member's only after their match has kicked off
-- (mirrors predictions_select_post_kickoff / match_has_kicked_off). Finished
-- points and exact scores are visibility-independent (finished matches are
-- visible to everyone), so they need no such guard.
--
-- Scoping mirrors computeStandings exactly:
--   • finished points / exact scores are scoped to the league's effective match
--     set (league_match_ids — honors per-link start_date/end_date), because the
--     old code only scored predictions whose match was in get_league_matches.
--   • booster usage is NOT scoped to the effective set — the old code counted
--     boosters over every visible prediction in the league_id (it tallied usage
--     before the match-membership check). Identical in a normal league (every
--     pick is in the effective set); differs only for a sealed league with a
--     boosted pick now outside its window, which the old code still counted.

create or replace function public.get_league_standings(p_league_id uuid)
returns table (
  user_id          uuid,
  finished_points  integer,
  exact_scores     integer,
  boosters_x2      integer,
  boosters_x3      integer,
  boosters_x5      integer
)
language sql
stable
security definer
set search_path = public
as $$
  with effective as (
    select match_id from public.league_match_ids(p_league_id)
  ),
  -- Frozen points from finished matches. A points row exists iff the match has
  -- finished (00006), so joining predictions → points implicitly scopes this to
  -- finished picks — no status check needed.
  finished as (
    select
      pr.user_id,
      sum(pt.total)::integer                              as finished_points,
      count(*) filter (where pt.base_points = 4)::integer as exact_scores
    from public.predictions pr
    join public.points pt on pt.prediction_id = pr.id
    where pr.league_id = p_league_id
      and pr.match_id in (select match_id from effective)
    group by pr.user_id
  ),
  -- Booster usage, honoring the blind-prediction rule.
  boosters as (
    select
      pr.user_id,
      count(*) filter (where pr.booster = 'x2')::integer as boosters_x2,
      count(*) filter (where pr.booster = 'x3')::integer as boosters_x3,
      count(*) filter (where pr.booster = 'x5')::integer as boosters_x5
    from public.predictions pr
    join public.matches m on m.id = pr.match_id
    where pr.league_id = p_league_id
      and pr.booster is not null
      and (pr.user_id = auth.uid() or m.kickoff_time <= now())
    group by pr.user_id
  )
  select
    lm.user_id,
    coalesce(f.finished_points, 0) as finished_points,
    coalesce(f.exact_scores, 0)    as exact_scores,
    coalesce(b.boosters_x2, 0)     as boosters_x2,
    coalesce(b.boosters_x3, 0)     as boosters_x3,
    coalesce(b.boosters_x5, 0)     as boosters_x5
  from public.league_members lm
  left join finished f on f.user_id = lm.user_id
  left join boosters b on b.user_id = lm.user_id
  where lm.league_id = p_league_id
    -- Membership guard: a non-member (or anon) gets an empty board, never
    -- another league's standings. is_league_member reads auth.uid().
    and public.is_league_member(p_league_id);
$$;

comment on function public.get_league_standings(uuid) is
  'Per-member league standings aggregate: finished points (SUM of frozen points.total), exact-score count (tiebreaker) and booster usage. Replaces the client-side O(members × matches) prediction pull; the client overlays only live matches for provisional matchday points. Members-only (is_league_member guard); booster counts honor the blind-prediction visibility rule.';

grant execute on function public.get_league_standings(uuid) to authenticated;
