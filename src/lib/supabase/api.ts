// Real Supabase implementation of the same surface as src/lib/mock/api.ts.
// All reads are scoped by RLS — we just SELECT and Postgres returns only
// what the current user is allowed to see.
//
// Browser client only. These functions are called from "use client"
// components via TanStack Query hooks; auth state lives in cookies that
// were set by the server / middleware.

import { createClient } from './client'
import {
  rowToCompetition,
  rowToLeague,
  rowToLeagueMember,
  rowToMatch,
  rowToPrediction,
  rowToProfile,
} from './mappers'
import {
  buildStandings,
  completedMatchSummary,
  isLeagueFinished,
  isUpcomingPredictable,
  liveMatchSummary,
  toDetailedPrediction,
  toFeedItem,
  upcomingMatchSummary,
} from '@/lib/derive'
import type { StandingAggregate } from '@/lib/derive'
import type {
  AddLeagueCompetitionInput,
  BoosterCounts,
  Competition,
  CreateLeagueInput,
  CreateLeagueResult,
  JoinLeagueInput,
  League,
  LeagueDashboardSummary,
  LeagueDetailPayload,
  LeagueMember,
  LeaguePredictionContext,
  Match,
  MatchDetailPayload,
  MomentFeedItem,
  MyLeagueCard,
  MyLeaguesPayload,
  Prediction,
  PredictionContextPayload,
  Profile,
  QuickPredictInput,
  RecentMomentsPage,
  RemoveLeagueMemberInput,
  StandingRow,
  SubmitPredictionInput,
  UpdateLeagueInput,
  UpdateProfileInput,
  UUID,
} from '@/types'

// ── Common select fragments ─────────────────────────────────────────────────

// Two FKs to `teams` need the constraint-name hint so PostgREST knows
// which one is which.
const MATCH_SELECT = `
  *,
  round:rounds(id, competition_id, name, sort_order, created_at),
  home_team:teams!matches_home_team_id_fkey(*),
  away_team:teams!matches_away_team_id_fkey(*)
`

// Pulls the league row plus its multi-comp links. Each link carries the
// start_date cutoff so the UI can render "tracking PL since May 9" if we
// ever want to. The join order isn't guaranteed by PostgREST — mappers
// sort by start_date.
const LEAGUE_SELECT = `
  *,
  league_competitions(
    start_date,
    competition:competitions(*)
  )
`

// ── Auth ────────────────────────────────────────────────────────────────────

async function requireUser(): Promise<{ id: UUID; profile: Profile }> {
  const supabase = createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) throw new Error('Not authenticated')

  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()
  if (profileErr) throw profileErr
  return { id: user.id, profile: rowToProfile(profile) }
}

export async function getCurrentUser(): Promise<Profile> {
  const { profile } = await requireUser()
  return profile
}

// ── Competitions ────────────────────────────────────────────────────────────

export async function listCompetitions(): Promise<Competition[]> {
  const supabase = createClient()
  const today = new Date().toISOString().slice(0, 10)
  const { data, error } = await supabase
    .from('competitions')
    .select('*')
    .gte('season_end', today)
    .order('season_start', { ascending: true })
  if (error) throw error
  return (data ?? []).map(rowToCompetition)
}

// ── Per-league raw fetchers ─────────────────────────────────────────────────

// Page through a PostgREST/RPC query in 1000-row windows until a short page
// marks the end. PostgREST silently caps each response at the project's
// max-rows (1000); an unbounded select past that drops the overflow without
// error — the truncation bug commit 6148cd0 fixed for the standings fetch. Any
// list query that can exceed 1000 rows for a big/long-running league routes
// through here. Callers must `.order(...)` by a unique key (or a tiebreak
// ending in one) so pages can't skip or repeat a row, with `.range(from, to)`
// applied last.
async function fetchAllPages<Row>(
  fetchPage: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: Row[] | null; error: unknown }>,
): Promise<Row[]> {
  const PAGE = 1000
  const rows: Row[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await fetchPage(from, from + PAGE - 1)
    if (error) throw error
    const batch = data ?? []
    rows.push(...batch)
    if (batch.length < PAGE) break
  }
  return rows
}

async function fetchLeagueWithCounts(
  leagueId: UUID,
): Promise<{ league: League; members: LeagueMember[] }> {
  const supabase = createClient()

  const [{ data: leagueRow, error: lErr }, { data: memberRows, error: mErr }] =
    await Promise.all([
      supabase.from('leagues').select(LEAGUE_SELECT).eq('id', leagueId).single(),
      supabase
        .from('league_members')
        .select('*, profile:profiles(*)')
        .eq('league_id', leagueId),
    ])
  if (lErr) throw lErr
  if (mErr) throw mErr

  const members = (memberRows ?? []).map(rowToLeagueMember)
  const league = rowToLeague(
    leagueRow as Parameters<typeof rowToLeague>[0],
    members.length,
  )
  return { league, members }
}

/**
 * Fetch the league's effective match set via the get_league_matches RPC.
 * The function returns SETOF matches, so PostgREST treats it like a table
 * query and we can chain the same MATCH_SELECT to embed teams + round.
 *
 * This is the single chokepoint for "what matches belong to this league?"
 * — replaces the old fetchMatchesForCompetition. Honors per-link
 * start_date cutoffs and any explicit league_matches picks.
 */
async function fetchMatchesForLeague(leagueId: UUID): Promise<Match[]> {
  const supabase = createClient()
  // PostgREST chains `.select(...)` onto a SETOF-table RPC at runtime to embed
  // FK joins, but the generated types don't model embeds on RPC results — cast
  // through `unknown` to MatchWithJoins, the shape MATCH_SELECT guarantees.
  // Paginated: a large multi-competition league's match set can exceed the
  // 1000-row cap. Order by kickoff_time then id (unique) so the kickoff sort is
  // preserved while pages stay stable (no skips/repeats across the boundary).
  type Row = Parameters<typeof rowToMatch>[0]
  const rows = await fetchAllPages<Row>(
    (from, to) =>
      supabase
        .rpc('get_league_matches', { p_league_id: leagueId })
        .select(MATCH_SELECT)
        .order('kickoff_time', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to) as unknown as PromiseLike<{
        data: Row[] | null
        error: unknown
      }>,
  )
  return rows.map(rowToMatch)
}

// Predictions joined with their persisted `points` row when finished.
// PostgREST embeds via the predictions→points 1:1 FK relationship; the
// embed comes back null for predictions whose match hasn't been scored
// yet, so the same query works for live + finished matches.
const PREDICTION_SELECT = '*, points(*)'

type PredictionRow = Parameters<typeof rowToPrediction>[0]

// Predictions for a specific set of matches in a league — bounded by
// (matches × members). Used for the live-match overlay + the live "who picked
// what" board, where we need every visible member's pick. RLS still hides
// others' picks for any match that hasn't kicked off.
async function fetchPredictionsForMatches(
  leagueId: UUID,
  matchIds: UUID[],
): Promise<Prediction[]> {
  if (matchIds.length === 0) return []
  const supabase = createClient()
  const rows = await fetchAllPages<PredictionRow>(
    (from, to) =>
      supabase
        .from('predictions')
        .select(PREDICTION_SELECT)
        .eq('league_id', leagueId)
        .in('match_id', matchIds)
        .order('id', { ascending: true })
        .range(from, to) as unknown as PromiseLike<{
        data: PredictionRow[] | null
        error: unknown
      }>,
  )
  return rows.map((row) => rowToPrediction(row))
}

// The current user's own picks across a league — bounded by the number of
// matches they've predicted (≤ the league's match count, NOT members ×
// matches). Drives the upcoming/completed match summaries, where only the
// viewer's own prediction is rendered. Carries the persisted `points` embed so
// finished picks resolve their stored points without a peer recompute.
async function fetchUserPredictionsForLeague(
  leagueId: UUID,
  userId: UUID,
): Promise<Prediction[]> {
  const supabase = createClient()
  const rows = await fetchAllPages<PredictionRow>(
    (from, to) =>
      supabase
        .from('predictions')
        .select(PREDICTION_SELECT)
        .eq('league_id', leagueId)
        .eq('user_id', userId)
        .order('id', { ascending: true })
        .range(from, to) as unknown as PromiseLike<{
        data: PredictionRow[] | null
        error: unknown
      }>,
  )
  return rows.map((row) => rowToPrediction(row))
}

// ── Standings (server-aggregated + live overlay) ─────────────────────────────

type StandingsRpcRow = {
  user_id: UUID
  finished_points: number
  exact_scores: number
  boosters_x2: number
  boosters_x3: number
  boosters_x5: number
}

/**
 * League standings without the old O(members × matches) prediction pull. The
 * finished half (points + exact-score tiebreaker + booster usage) is summed by
 * the get_league_standings RPC; only currently-live matches are fetched and
 * scored client-side for provisional matchday points. Returns those live
 * predictions too, so callers that also render live-match summaries reuse them
 * instead of refetching.
 *
 * `matches` is the league's effective match set (already fetched by callers for
 * their upcoming/live/finished sections); we read the live ones from it.
 * `withPositionChange` enables the ▲/▼ movement column (league + match detail).
 */
async function loadLeagueStandings(args: {
  leagueId: UUID
  members: LeagueMember[]
  matches: Match[]
  leaguePool: BoosterCounts
  currentUserId?: UUID
  withPositionChange?: boolean
}): Promise<{ standings: StandingRow[]; livePredictions: Prediction[] }> {
  const {
    leagueId,
    members,
    matches,
    leaguePool,
    currentUserId,
    withPositionChange,
  } = args
  const supabase = createClient()

  const liveMatches = matches.filter((m) => m.status === 'live')

  // Aggregate (RPC) and the live overlay are independent — fetch in parallel.
  const [{ data: aggRows, error }, livePredictions] = await Promise.all([
    supabase.rpc('get_league_standings', { p_league_id: leagueId }),
    fetchPredictionsForMatches(
      leagueId,
      liveMatches.map((m) => m.id),
    ),
  ])
  if (error) throw error

  const aggregates = new Map<UUID, StandingAggregate>()
  for (const r of (aggRows ?? []) as StandingsRpcRow[]) {
    aggregates.set(r.user_id, {
      finishedPoints: r.finished_points,
      exactScores: r.exact_scores,
      boostersUsed: { x2: r.boosters_x2, x3: r.boosters_x3, x5: r.boosters_x5 },
    })
  }

  const standings = buildStandings({
    members,
    aggregates,
    liveMatches,
    livePredictions,
    leaguePool,
    currentUserId,
    withPositionChange,
  })
  return { standings, livePredictions }
}

// ── Dashboard ───────────────────────────────────────────────────────────────

export async function getDashboard(): Promise<LeagueDashboardSummary[]> {
  const { id: userId } = await requireUser()
  const supabase = createClient()

  const { data: memberRows, error } = await supabase
    .from('league_members')
    .select(`league:leagues(${LEAGUE_SELECT})`)
    .eq('user_id', userId)
  if (error) throw error

  const summaries: LeagueDashboardSummary[] = []
  for (const row of memberRows ?? []) {
    const leagueRow = row.league as unknown as Parameters<typeof rowToLeague>[0]
    if (!leagueRow) continue
    // "Finished" used to be a cheap pre-check off season_end metadata,
    // but that's unreliable (cup finals after season_end). The real
    // signal lives in the matches list — fetch and check there.
    const summary = await buildLeagueDashboardSummary(leagueRow.id, userId)
    if (summary) summaries.push(summary)
  }
  return summaries
}

async function buildLeagueDashboardSummary(
  leagueId: UUID,
  userId: UUID,
): Promise<LeagueDashboardSummary | null> {
  const { league, members } = await fetchLeagueWithCounts(leagueId)
  const matches = await fetchMatchesForLeague(leagueId)
  // Skip leagues whose matches are all finished — nothing to dashboard.
  if (isLeagueFinished(matches)) return null

  // Standings (server-aggregated + live overlay) and the viewer's own picks
  // (for the upcoming-match summaries) are independent — fetch in parallel.
  const [{ standings, livePredictions }, userPredictions] = await Promise.all([
    loadLeagueStandings({
      leagueId,
      members,
      matches,
      leaguePool: league.settings.boosters.pool,
      currentUserId: userId,
    }),
    fetchUserPredictionsForLeague(leagueId, userId),
  ])
  const userRow = standings.find((r) => r.profile.id === userId)
  const profileById = new Map(members.map((m) => [m.userId, m.profile]))

  const liveMatches = matches
    .filter((m) => m.status === 'live')
    .sort((a, b) => a.kickoffTime.localeCompare(b.kickoffTime))
    .map((match) =>
      liveMatchSummary({
        match,
        predictions: livePredictions.filter((p) => p.matchId === match.id),
        userId,
        profileById,
        memberCount: members.length,
      }),
    )

  const upcomingMatches = matches
    .filter(isUpcomingPredictable)
    .sort((a, b) => a.kickoffTime.localeCompare(b.kickoffTime))
    .map((match) =>
      upcomingMatchSummary({
        match,
        userPrediction:
          userPredictions.find((p) => p.matchId === match.id) ?? null,
      }),
    )

  const unpredictedCount = upcomingMatches.filter(
    (u) => u.userPrediction === null,
  ).length

  // Compact preview for the dashboard card: top 3 + the user's row if
  // they're outside the top 3. The dashboard renderer can detect the
  // gap from row[i].position vs row[i-1].position and draw the "…"
  // separator without us having to flag it.
  const top3 = standings.slice(0, 3)
  const userInTop3 = userRow ? top3.includes(userRow) : false
  const standingsPreview =
    userRow && !userInTop3 ? [...top3, userRow] : top3

  return {
    league,
    userPosition: userRow?.position ?? standings.length + 1,
    userTotalPoints:
      (userRow?.totalPoints ?? 0) + (userRow?.matchdayPoints ?? 0),
    userMatchdayPoints: userRow?.matchdayPoints ?? 0,
    userBoostersRemaining:
      userRow?.boostersRemaining ?? league.settings.boosters.pool,
    liveMatches,
    upcomingMatches,
    unpredictedCount,
    standingsPreview,
  }
}

// ── My Leagues ──────────────────────────────────────────────────────────────

export async function getMyLeagues(): Promise<MyLeaguesPayload> {
  const { id: userId } = await requireUser()
  const supabase = createClient()

  const { data: memberRows, error } = await supabase
    .from('league_members')
    .select(`league:leagues(${LEAGUE_SELECT})`)
    .eq('user_id', userId)
  if (error) throw error

  const cards: MyLeagueCard[] = []
  for (const row of memberRows ?? []) {
    const leagueRow = row.league as unknown as Parameters<typeof rowToLeague>[0]
    if (!leagueRow) continue

    const { league, members } = await fetchLeagueWithCounts(leagueRow.id)
    const matches = await fetchMatchesForLeague(leagueRow.id)

    // My-leagues only needs the viewer's own row — no per-match summaries — so
    // just the aggregated standings + live overlay, no full prediction pull.
    const { standings } = await loadLeagueStandings({
      leagueId: leagueRow.id,
      members,
      matches,
      leaguePool: league.settings.boosters.pool,
      currentUserId: userId,
    })
    const userRow = standings.find((r) => r.profile.id === userId)
    const userPosition = userRow?.position ?? standings.length + 1
    const userPoints =
      (userRow?.totalPoints ?? 0) + (userRow?.matchdayPoints ?? 0)
    const next =
      matches
        .filter(isUpcomingPredictable)
        .sort((a, b) => a.kickoffTime.localeCompare(b.kickoffTime))[0] ?? null

    const completed = isLeagueFinished(matches)
    let finalBadge: MyLeagueCard['finalBadge'] = null
    if (completed) {
      if (userPosition === 1) finalBadge = '1st'
      else if (userPosition === 2) finalBadge = '2nd'
      else if (userPosition === 3) finalBadge = '3rd'
    }

    cards.push({
      league,
      userPosition,
      userPoints,
      nextMatchKickoff: next?.kickoffTime ?? null,
      isCompleted: completed,
      finalBadge,
    })
  }

  const active = cards.filter((c) => !c.isCompleted)
  const completed = cards.filter((c) => c.isCompleted)
  const topThree = completed.filter((c) => c.userPosition <= 3).length

  return {
    active,
    completed,
    stats: {
      totalLeagues: cards.length,
      activeLeagues: active.length,
      topThreeFinishes: topThree,
    },
  }
}

// ── League detail ───────────────────────────────────────────────────────────

export async function getLeagueDetail(
  leagueId: UUID,
): Promise<LeagueDetailPayload> {
  const { id: userId } = await requireUser()

  const { league, members } = await fetchLeagueWithCounts(leagueId)
  const matches = await fetchMatchesForLeague(leagueId)

  // Standings (server-aggregated + live overlay; withPositionChange drives the
  // ▲/▼ column) and the viewer's own picks (for the upcoming + completed
  // summaries, which render only the viewer's row) are independent.
  const [{ standings, livePredictions }, userPredictions] = await Promise.all([
    loadLeagueStandings({
      leagueId,
      members,
      matches,
      leaguePool: league.settings.boosters.pool,
      currentUserId: userId,
      withPositionChange: true,
    }),
    fetchUserPredictionsForLeague(leagueId, userId),
  ])
  const profileById = new Map(members.map((m) => [m.userId, m.profile]))

  const live = matches
    .filter((m) => m.status === 'live')
    .sort((a, b) => a.kickoffTime.localeCompare(b.kickoffTime))
  const upcoming = matches
    .filter(isUpcomingPredictable)
    .sort((a, b) => a.kickoffTime.localeCompare(b.kickoffTime))
  const finished = matches
    .filter((m) => m.status === 'finished')
    .sort((a, b) => b.kickoffTime.localeCompare(a.kickoffTime))

  const isAdmin = members.some(
    (m) => m.userId === userId && m.role === 'admin',
  )

  return {
    league,
    isAdmin,
    members,
    standings,
    liveMatches: live.map((match) =>
      liveMatchSummary({
        match,
        predictions: livePredictions.filter((p) => p.matchId === match.id),
        userId,
        profileById,
        memberCount: members.length,
      }),
    ),
    upcomingMatches: upcoming.map((match) =>
      upcomingMatchSummary({
        match,
        userPrediction:
          userPredictions.find((p) => p.matchId === match.id) ?? null,
      }),
    ),
    // completedMatchSummary renders only the viewer's own result, and a
    // finished pick's points come from its persisted `points` row (no peer
    // recompute), so the viewer's own predictions are all this needs.
    completedMatches: finished.map((match) =>
      completedMatchSummary({
        match,
        predictions: userPredictions.filter((p) => p.matchId === match.id),
        userId,
        profileById,
        memberCount: members.length,
      }),
    ),
  }
}

// ── Match detail (single match deep view) ───────────────────────────────────

export async function getMatchDetail(
  matchId: UUID,
  leagueId: UUID,
): Promise<MatchDetailPayload> {
  const { id: userId } = await requireUser()
  const supabase = createClient()

  const { league, members } = await fetchLeagueWithCounts(leagueId)
  const profileById = new Map(members.map((m) => [m.userId, m.profile]))

  const { data: matchRow, error: mErr } = await supabase
    .from('matches')
    .select(MATCH_SELECT)
    .eq('id', matchId)
    .single()
  if (mErr) throw mErr
  const match = rowToMatch(matchRow as Parameters<typeof rowToMatch>[0])

  // Predictions for this match in this league. RLS already enforces the
  // blind-prediction rule (others' picks hidden pre-kickoff).
  const { data: predRows, error: pErr } = await supabase
    .from('predictions')
    .select(PREDICTION_SELECT)
    .eq('match_id', matchId)
    .eq('league_id', leagueId)
  if (pErr) throw pErr
  const predictions = (predRows ?? []).map((row) =>
    rowToPrediction(row as Parameters<typeof rowToPrediction>[0]),
  )

  // For the standings tab, we need league-wide context — aggregated
  // server-side plus the live overlay (withPositionChange drives the ▲/▼
  // column). The per-match predictions above stay the source for this match's
  // board; the live overlay independently covers all live matches.
  const allLeagueMatches = await fetchMatchesForLeague(leagueId)
  const { standings } = await loadLeagueStandings({
    leagueId,
    members,
    matches: allLeagueMatches,
    leaguePool: league.settings.boosters.pool,
    currentUserId: userId,
    withPositionChange: true,
  })

  const memberCount = members.length

  // toDetailedPrediction resolves points the canonical way: persisted
  // `storedPoints` for finished matches (server-authoritative rarity + audit
  // fields), recompute for live, null for scheduled.
  const detailedWithPoints = predictions.map((p) =>
    toDetailedPrediction(p, match, predictions, profileById, memberCount),
  )

  const userPredDetailed =
    detailedWithPoints.find((p) => p.userId === userId) ?? null

  return {
    match,
    league: { id: league.id, name: league.name, icon: league.icon },
    predictions: detailedWithPoints,
    userPrediction: userPredDetailed,
    standings,
    memberCount,
  }
}

// ── Recent moments (match-story feed) ───────────────────────────────────────

/**
 * Rolling feed of match "stories", newest-first. Cross-league when `leagueId`
 * is omitted (union of the user's leagues, each item tagged with its league);
 * single-league when given. Paginated by a kickoff_time cursor for load-more.
 *
 * Batched to avoid N+1: leagues + rosters up front, finished matches via the
 * league-matches chokepoint, then all predictions for the windowed matches in
 * one paginated query. Feed items (overview + standouts) are assembled in TS.
 */
export async function getRecentMoments(args: {
  leagueId?: UUID
  limit: number
  cursor?: string
}): Promise<RecentMomentsPage> {
  const { leagueId, limit, cursor } = args
  const { id: userId } = await requireUser()
  const supabase = createClient()

  // 1. Target leagues ({id,name,icon}) + member rosters.
  type LeagueLite = { id: UUID; name: string; icon: string | null }
  const leaguesById = new Map<UUID, LeagueLite>()
  const membersByLeague = new Map<UUID, LeagueMember[]>()

  if (leagueId) {
    const { league, members } = await fetchLeagueWithCounts(leagueId)
    leaguesById.set(league.id, {
      id: league.id,
      name: league.name,
      icon: league.icon,
    })
    membersByLeague.set(league.id, members)
  } else {
    const { data: leagueRows, error: lErr } = await supabase
      .from('league_members')
      .select(`league:leagues(${LEAGUE_SELECT})`)
      .eq('user_id', userId)
    if (lErr) throw lErr
    const myLeagueIds: UUID[] = []
    for (const row of leagueRows ?? []) {
      const lr = row.league as unknown as Parameters<typeof rowToLeague>[0]
      if (!lr) continue
      const lg = rowToLeague(lr, 0) // memberCount unused here; rosters drive it
      leaguesById.set(lg.id, { id: lg.id, name: lg.name, icon: lg.icon })
      myLeagueIds.push(lg.id)
    }
    if (myLeagueIds.length === 0) return { items: [], nextCursor: null }

    const { data: rosterRows, error: rErr } = await supabase
      .from('league_members')
      .select('*, profile:profiles(*)')
      .in('league_id', myLeagueIds)
    if (rErr) throw rErr
    for (const row of rosterRows ?? []) {
      const m = rowToLeagueMember(
        row as Parameters<typeof rowToLeagueMember>[0],
      )
      const arr = membersByLeague.get(m.leagueId) ?? []
      arr.push(m)
      membersByLeague.set(m.leagueId, arr)
    }
  }

  // 2. Finished matches per league (reuse the league-matches chokepoint),
  //    cursor-filtered, tagged with their league, newest-first overall.
  //    The cursor is a composite key (kickoff#match#league) giving a strict
  //    total order, so paging back never skips matches that share a kickoff
  //    time — common in tournaments where several games start at once.
  const keyOf = (kickoff: string, matchId: string, lid: string) =>
    `${kickoff}#${matchId}#${lid}`
  type Tagged = { match: Match; leagueId: UUID; key: string }
  const finished: Tagged[] = []
  await Promise.all(
    [...leaguesById.keys()].map(async (lid) => {
      const matches = await fetchMatchesForLeague(lid)
      for (const m of matches) {
        if (m.status !== 'finished') continue
        const key = keyOf(m.kickoffTime, m.id, lid)
        if (cursor && !(key < cursor)) continue
        finished.push({ match: m, leagueId: lid, key })
      }
    }),
  )
  // Strict descending key order (kickoff, then match, then league).
  finished.sort((a, b) => (a.key < b.key ? 1 : a.key > b.key ? -1 : 0))
  if (finished.length === 0) return { items: [], nextCursor: null }

  // Scan a window larger than `limit` so storyless matches (nobody predicted)
  // don't starve the page. We slice to `limit` after assembly.
  const window = finished.slice(0, limit * 3)

  // 3. All predictions for the windowed (match,league) pairs. Paginated: a
  //    wide window across a many-member league can exceed the 1000-row cap.
  const matchIds = [...new Set(window.map((t) => t.match.id))]
  const leagueIds = [...new Set(window.map((t) => t.leagueId))]
  const predRows = await fetchAllPages<PredictionRow>(
    (from, to) =>
      supabase
        .from('predictions')
        .select(PREDICTION_SELECT)
        .in('match_id', matchIds)
        .in('league_id', leagueIds)
        .order('id', { ascending: true })
        .range(from, to) as unknown as PromiseLike<{
        data: PredictionRow[] | null
        error: unknown
      }>,
  )
  const predsByKey = new Map<string, Prediction[]>()
  for (const row of predRows) {
    const p = rowToPrediction(row)
    const key = `${p.matchId}::${p.leagueId}`
    const arr = predsByKey.get(key) ?? []
    arr.push(p)
    predsByKey.set(key, arr)
  }

  // 4. Assemble feed items (overview + standouts) for each windowed pair.
  const items: MomentFeedItem[] = []
  for (const { match, leagueId: lid } of window) {
    const league = leaguesById.get(lid)
    if (!league) continue
    const members = membersByLeague.get(lid) ?? []
    const profileById = new Map(members.map((m) => [m.userId, m.profile]))
    const raw = predsByKey.get(`${match.id}::${lid}`) ?? []
    const detailed = raw.map((p) =>
      toDetailedPrediction(p, match, raw, profileById, members.length),
    )
    const item = toFeedItem({
      match,
      predictions: detailed,
      memberCount: members.length,
      league,
      viewerId: userId,
    })
    if (item) items.push(item)
  }

  // Keep the strict key order (matches the cursor) so paging back covers the
  // whole history without skips or repeats.
  const itemKey = (it: MomentFeedItem) =>
    keyOf(it.kickoffTime, it.matchId, it.league.id)
  items.sort((a, b) => {
    const ak = itemKey(a)
    const bk = itemKey(b)
    return ak < bk ? 1 : ak > bk ? -1 : 0
  })
  const page = items.slice(0, limit)

  // Cursor: a full page continues from the last story's key. If the window ran
  // dry without filling the page but more finished matches exist beyond it,
  // continue from the window's oldest match so the tail isn't lost. Otherwise
  // we've reached the end of history.
  let nextCursor: string | null = null
  if (page.length === limit) {
    nextCursor = itemKey(page[page.length - 1])
  } else if (window.length < finished.length) {
    nextCursor = window[window.length - 1].key
  }
  return { items: page, nextCursor }
}

// ── Prediction context (modal) ──────────────────────────────────────────────

export async function getPredictionContext(
  matchId: UUID,
): Promise<PredictionContextPayload> {
  const { id: userId } = await requireUser()
  const supabase = createClient()

  const { data: matchRow, error: mErr } = await supabase
    .from('matches')
    .select(MATCH_SELECT)
    .eq('id', matchId)
    .single()
  if (mErr) throw mErr
  const match = rowToMatch(matchRow as Parameters<typeof rowToMatch>[0])

  // All leagues the user is in for this competition.
  const { data: memberRows, error: lErr } = await supabase
    .from('league_members')
    .select(`league:leagues(${LEAGUE_SELECT})`)
    .eq('user_id', userId)
  if (lErr) throw lErr

  const contexts: LeaguePredictionContext[] = []
  for (const row of memberRows ?? []) {
    const leagueRow = row.league as unknown as Parameters<typeof rowToLeague>[0]
    if (!leagueRow) continue

    // Two-step filter: a league must (1) link this match's competition
    // and have its start_date earlier than the match kickoff, AND (2)
    // not be entirely finished. Pre-filtering here avoids fetching
    // matches/predictions for leagues that don't even include this match.
    const lite = rowToLeague(leagueRow, 0)
    const matchInLeague = lite.competitions.some(
      (lc) =>
        lc.competition.id === match.competitionId &&
        new Date(match.kickoffTime).getTime() >=
          new Date(lc.startDate).getTime(),
    )
    if (!matchInLeague) continue

    const { league, members } = await fetchLeagueWithCounts(leagueRow.id)
    const matches = await fetchMatchesForLeague(leagueRow.id)
    // Only skip if the league has truly no remaining work — but the very
    // match the user is editing on is in the league, so this almost
    // always lets the context through (the cup-final case included).
    if (isLeagueFinished(matches)) continue

    // Standings (aggregated + live overlay) and the viewer's existing pick for
    // this one match are independent — fetch in parallel.
    const [{ standings }, { data: cpRow, error: cpErr }] = await Promise.all([
      loadLeagueStandings({
        leagueId: leagueRow.id,
        members,
        matches,
        leaguePool: league.settings.boosters.pool,
        currentUserId: userId,
      }),
      supabase
        .from('predictions')
        .select(PREDICTION_SELECT)
        .eq('match_id', matchId)
        .eq('league_id', leagueRow.id)
        .eq('user_id', userId)
        .maybeSingle(),
    ])
    if (cpErr) throw cpErr
    const userRow = standings.find((r) => r.profile.id === userId)
    const leader = standings[0]
    const leaderGap =
      userRow && leader
        ? leader.totalPoints + leader.matchdayPoints
          - (userRow.totalPoints + userRow.matchdayPoints)
        : 0
    const currentPrediction = cpRow
      ? rowToPrediction(cpRow as PredictionRow)
      : null

    contexts.push({
      leagueId: league.id,
      leagueName: league.name,
      leagueIcon: league.icon,
      currentPosition: userRow?.position ?? standings.length + 1,
      currentPoints: (userRow?.totalPoints ?? 0) + (userRow?.matchdayPoints ?? 0),
      leaderGap,
      currentPrediction,
      boostersEnabled: league.settings.boosters.enabled,
      boostersRemaining: userRow?.boostersRemaining ?? league.settings.boosters.pool,
    })
  }

  return { match, leagues: contexts }
}

// ── Mutations ───────────────────────────────────────────────────────────────

export async function submitPrediction(
  input: SubmitPredictionInput,
): Promise<void> {
  const { id: userId } = await requireUser()
  const supabase = createClient()

  // Upsert by (user, match, league) — covers both first-time and edits.
  const { error } = await supabase
    .from('predictions')
    .upsert(
      {
        user_id: userId,
        match_id: input.matchId,
        league_id: input.leagueId,
        home_score: input.homeScore,
        away_score: input.awayScore,
        booster: input.booster,
      },
      { onConflict: 'user_id,match_id,league_id' },
    )
  if (error) throw error
}

export async function quickPredict(input: QuickPredictInput): Promise<void> {
  const { leagues } = await getPredictionContext(input.matchId)
  await Promise.all(
    leagues.map((lg) =>
      submitPrediction({
        matchId: input.matchId,
        leagueId: lg.leagueId,
        homeScore: input.homeScore,
        awayScore: input.awayScore,
        // Preserve existing booster — Quick Predict only updates the score.
        booster: lg.currentPrediction?.booster ?? null,
      }),
    ),
  )
}

export async function createLeague(
  input: CreateLeagueInput,
): Promise<CreateLeagueResult> {
  const { id: userId } = await requireUser()
  const supabase = createClient()

  if (input.competitionIds.length === 0) {
    throw new Error('Pick at least one competition')
  }

  const inviteCode = Math.random().toString(36).slice(2, 8).toUpperCase()

  // Insert the league first. The leagues_auto_add_creator trigger
  // inserts the creator as admin member in the same transaction, before
  // RETURNING — so we have admin role for the league_competitions inserts
  // below.
  const { data: leagueRow, error: lErr } = await supabase
    .from('leagues')
    .insert({
      name: input.name,
      description: input.description,
      invite_code: inviteCode,
      icon: input.icon,
      created_by: userId,
      settings: input.settings,
    })
    .select('id')
    .single()
  if (lErr) throw lErr

  // Bulk-insert the competition links. start_date defaults to now() so
  // mid-season leagues start clean (no zero-point historical matches).
  const { error: lcErr } = await supabase
    .from('league_competitions')
    .insert(
      input.competitionIds.map((competition_id) => ({
        league_id: leagueRow.id,
        competition_id,
        added_by: userId,
      })),
    )
  if (lcErr) throw lcErr

  // Re-fetch with the joined competitions so the caller gets a fully
  // populated League domain object (including the comp emblems for the
  // success screen).
  const { data: fullRow, error: fErr } = await supabase
    .from('leagues')
    .select(LEAGUE_SELECT)
    .eq('id', leagueRow.id)
    .single()
  if (fErr) throw fErr

  const league = rowToLeague(
    fullRow as Parameters<typeof rowToLeague>[0],
    1,
  )
  return {
    league,
    inviteUrl: `eksakt.app/join/${league.inviteCode}`,
  }
}

/**
 * Attach an additional competition to an existing league. Admin-only
 * (RLS enforces). The new link's start_date defaults to now(), so only
 * matches kicking off after this moment count — same fairness rule as
 * creating a league mid-season.
 */
export async function addLeagueCompetition(
  input: AddLeagueCompetitionInput,
): Promise<void> {
  const { id: userId } = await requireUser()
  const supabase = createClient()
  const { error } = await supabase.from('league_competitions').insert({
    league_id: input.leagueId,
    competition_id: input.competitionId,
    added_by: userId,
  })
  if (error) throw error
}

/**
 * Update league metadata. Restricted to admins via RLS
 * (`leagues_update_admin` policy). Only fields explicitly passed are
 * written — undefined = "leave alone", null on icon = "clear it".
 */
export async function updateLeague(
  input: UpdateLeagueInput,
): Promise<League> {
  await requireUser()
  const supabase = createClient()

  const patch: Record<string, unknown> = {}
  if (input.name !== undefined) patch.name = input.name
  if (input.icon !== undefined) patch.icon = input.icon

  if (Object.keys(patch).length === 0) {
    // No fields to change — refetch and return current state.
    const { league } = await fetchLeagueWithCounts(input.leagueId)
    return league
  }

  const { error } = await supabase
    .from('leagues')
    .update(patch)
    .eq('id', input.leagueId)
  if (error) throw error

  const { league } = await fetchLeagueWithCounts(input.leagueId)
  return league
}

/**
 * Join a league by its invite code. Calls the join_league_by_code RPC
 * which atomically looks up the league + inserts the membership row,
 * bypassing RLS on the lookup (you can't see leagues you're not in
 * yet, by design).
 *
 * Idempotent — joining a league you're already in returns the same
 * league cleanly. Throws "invite code not found" for unknown codes.
 */
export async function joinLeague(input: JoinLeagueInput): Promise<League> {
  await requireUser()
  const supabase = createClient()

  const { data: leagueId, error: rpcErr } = await supabase.rpc(
    'join_league_by_code',
    { p_code: input.inviteCode },
  )
  if (rpcErr) {
    if (rpcErr.code === 'P0002') {
      throw new Error('Invite code not found. Check it and try again.')
    }
    throw rpcErr
  }
  if (!leagueId) {
    throw new Error('Invite code not found. Check it and try again.')
  }

  // Fetch the now-joinable league row.
  const { league } = await fetchLeagueWithCounts(leagueId)
  return league
}

/**
 * Admin-only: remove a member from the league. Calls the
 * remove_league_member RPC which enforces:
 *   • caller is an admin of the league
 *   • target is not themselves an admin
 *   • caller is not removing themselves (use leaveLeague for that)
 *
 * Their predictions stay on record — the kick only revokes league access.
 */
export async function removeLeagueMember(
  input: RemoveLeagueMemberInput,
): Promise<void> {
  await requireUser()
  const supabase = createClient()
  const { error } = await supabase.rpc('remove_league_member', {
    p_league_id: input.leagueId,
    p_user_id: input.userId,
  })
  if (error) throw error
}

// ── Profile ─────────────────────────────────────────────────────────────────

/**
 * Update the current user's profile. Pass only the fields you want to
 * change. RLS ensures the caller can only update their own row
 * (`profiles_update_self` policy).
 */
export async function updateProfile(input: UpdateProfileInput): Promise<Profile> {
  const { id: userId } = await requireUser()
  const supabase = createClient()

  const patch: {
    display_name?: string
    avatar_url?: string | null
    notifications_enabled?: boolean
  } = {}
  if (input.displayName !== undefined) patch.display_name = input.displayName
  if (input.avatarUrl !== undefined) patch.avatar_url = input.avatarUrl
  if (input.notificationsEnabled !== undefined)
    patch.notifications_enabled = input.notificationsEnabled

  const { data, error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', userId)
    .select('*')
    .single()
  if (error) throw error
  return rowToProfile(data)
}

/**
 * Upload a new avatar image to Storage and return its public URL.
 *
 * Path: `<user_id>/<timestamp>.<ext>` — timestamp in the filename is the
 * cache-buster. We don't bother deleting the previous file; orphans are
 * cheap and a periodic cleanup job can reap them later.
 *
 * Storage RLS restricts writes to the caller's own folder, so even if a
 * malicious client patched the path, the upload would be rejected.
 */
export async function uploadAvatar(file: File): Promise<string> {
  const { id: userId } = await requireUser()
  const supabase = createClient()

  const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase()
  const path = `${userId}/${Date.now()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(path, file, {
      contentType: file.type,
      cacheControl: '3600',
      upsert: false,
    })
  if (uploadError) throw uploadError

  const { data } = supabase.storage.from('avatars').getPublicUrl(path)
  return data.publicUrl
}

export async function signOut(): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

// Re-export StandingRow so callers can introspect what the standings helpers
// return without crossing module boundaries.
export type { StandingRow }
