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
  completedMatchSummary,
  computeStandings,
  isLeagueFinished,
  isUpcomingPredictable,
  liveMatchSummary,
  upcomingMatchSummary,
} from '@/lib/derive'
import { computePoints, computeRarity } from '@/lib/scoring'
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
  MyLeagueCard,
  MyLeaguesPayload,
  Prediction,
  PredictionContextPayload,
  Profile,
  QuickPredictInput,
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
  // PostgREST chains `.select(...)` onto a SETOF-table RPC at runtime to
  // embed FK joins, but the generated types don't model embeds on RPC
  // results. Cast through `unknown` to MatchWithJoins — the shape is
  // guaranteed by MATCH_SELECT.
  const { data, error } = await supabase
    .rpc('get_league_matches', { p_league_id: leagueId })
    .select(MATCH_SELECT)
    .order('kickoff_time', { ascending: true })
  if (error) throw error
  const rows = (data ?? []) as unknown as Parameters<typeof rowToMatch>[0][]
  return rows.map(rowToMatch)
}

// Predictions joined with their persisted `points` row when finished.
// PostgREST embeds via the predictions→points 1:1 FK relationship; the
// embed comes back null for predictions whose match hasn't been scored
// yet, so the same query works for live + finished matches.
const PREDICTION_SELECT = '*, points(*)'

async function fetchPredictionsForLeague(
  leagueId: UUID,
): Promise<Prediction[]> {
  // RLS hides others' predictions for matches that haven't kicked off yet,
  // so this naturally returns: my picks for everything, others' picks only
  // for live/finished matches.
  const supabase = createClient()
  const { data, error } = await supabase
    .from('predictions')
    .select(PREDICTION_SELECT)
    .eq('league_id', leagueId)
  if (error) throw error
  return (data ?? []).map((row) =>
    rowToPrediction(row as Parameters<typeof rowToPrediction>[0]),
  )
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
  const predictions = await fetchPredictionsForLeague(leagueId)

  const standings = computeStandings({
    members,
    matches,
    predictions,
    leaguePool: league.settings.boosters.pool,
    currentUserId: userId,
  })
  const userRow = standings.find((r) => r.profile.id === userId)
  const profileById = new Map(members.map((m) => [m.userId, m.profile]))

  const liveMatches = matches
    .filter((m) => m.status === 'live')
    .sort((a, b) => a.kickoffTime.localeCompare(b.kickoffTime))
    .map((match) =>
      liveMatchSummary({
        match,
        predictions: predictions.filter((p) => p.matchId === match.id),
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
          predictions.find(
            (p) => p.matchId === match.id && p.userId === userId,
          ) ?? null,
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
    const predictions = await fetchPredictionsForLeague(leagueRow.id)

    const standings = computeStandings({
      members,
      matches,
      predictions,
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

// Map of profile.id → standings position computed from finished matches
// only (live matches excluded). Passed to computeStandings as the
// `beforeSnapshot` so the ▲/▼ movement column reflects how live results
// are currently shifting positions. Returns undefined when nothing is
// live (no movement to show, avoids a redundant pass).
function positionSnapshotBeforeLive(
  members: LeagueMember[],
  matches: Match[],
  predictions: Prediction[],
  leaguePool: BoosterCounts,
): Record<UUID, number> | undefined {
  const hasLive = matches.some((m) => m.status === 'live')
  if (!hasLive) return undefined

  const before = computeStandings({
    members,
    matches: matches.filter((m) => m.status !== 'live'),
    predictions,
    leaguePool,
  })
  const snapshot: Record<UUID, number> = {}
  for (const row of before) snapshot[row.profile.id] = row.position
  return snapshot
}

export async function getLeagueDetail(
  leagueId: UUID,
): Promise<LeagueDetailPayload> {
  const { id: userId } = await requireUser()

  const { league, members } = await fetchLeagueWithCounts(leagueId)
  const matches = await fetchMatchesForLeague(leagueId)
  const predictions = await fetchPredictionsForLeague(leagueId)

  const standings = computeStandings({
    members,
    matches,
    predictions,
    leaguePool: league.settings.boosters.pool,
    currentUserId: userId,
    beforeSnapshot: positionSnapshotBeforeLive(
      members,
      matches,
      predictions,
      league.settings.boosters.pool,
    ),
  })
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
        predictions: predictions.filter((p) => p.matchId === match.id),
        userId,
        profileById,
        memberCount: members.length,
      }),
    ),
    upcomingMatches: upcoming.map((match) =>
      upcomingMatchSummary({
        match,
        userPrediction:
          predictions.find(
            (p) => p.matchId === match.id && p.userId === userId,
          ) ?? null,
      }),
    ),
    completedMatches: finished.map((match) =>
      completedMatchSummary({
        match,
        predictions: predictions.filter((p) => p.matchId === match.id),
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

  // For the standings tab, we need league-wide context.
  const allLeagueMatches = await fetchMatchesForLeague(leagueId)
  const allLeaguePredictions = await fetchPredictionsForLeague(leagueId)
  const standings = computeStandings({
    members,
    matches: allLeagueMatches,
    predictions: allLeaguePredictions,
    leaguePool: league.settings.boosters.pool,
    currentUserId: userId,
    beforeSnapshot: positionSnapshotBeforeLive(
      members,
      allLeagueMatches,
      allLeaguePredictions,
      league.settings.boosters.pool,
    ),
  })

  const isLocked = match.status !== 'scheduled'
  const memberCount = members.length

  // For finished matches, the persisted `storedPoints` row is server-
  // authoritative (canonical rarity, audit fields). For live matches we
  // must always recompute — stale `points` rows can linger if a match
  // was previously finished and then re-opened (manual sync, upstream
  // correction), and trusting them would show points against a previous
  // final score instead of the current live one.
  const detailedWithPoints = predictions.map((p) => ({
    ...p,
    profile:
      profileById.get(p.userId) ??
      ({ id: p.userId, displayName: '?', avatarUrl: null } as Profile),
    points:
      !isLocked || match.homeScore == null || match.awayScore == null
        ? null
        : match.status === 'finished' && p.storedPoints
          ? p.storedPoints
          : computePoints({
              prediction: {
                homeScore: p.homeScore,
                awayScore: p.awayScore,
                booster: p.booster,
              },
              finalScore: { home: match.homeScore, away: match.awayScore },
              rarity: computeRarity(p, predictions, memberCount),
              final: match.status === 'finished',
            }),
  }))

  const userPredDetailed =
    detailedWithPoints.find((p) => p.userId === userId) ?? null

  return {
    match,
    league: { id: league.id, name: league.name },
    predictions: detailedWithPoints,
    userPrediction: userPredDetailed,
    standings,
  }
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
    const predictions = await fetchPredictionsForLeague(leagueRow.id)

    const standings = computeStandings({
      members,
      matches,
      predictions,
      leaguePool: league.settings.boosters.pool,
      currentUserId: userId,
    })
    const userRow = standings.find((r) => r.profile.id === userId)
    const leader = standings[0]
    const leaderGap =
      userRow && leader
        ? leader.totalPoints + leader.matchdayPoints
          - (userRow.totalPoints + userRow.matchdayPoints)
        : 0
    const currentPrediction =
      predictions.find(
        (p) => p.matchId === matchId && p.userId === userId,
      ) ?? null

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

  const patch: { display_name?: string; avatar_url?: string | null } = {}
  if (input.displayName !== undefined) patch.display_name = input.displayName
  if (input.avatarUrl !== undefined) patch.avatar_url = input.avatarUrl

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

// Re-export StandingRow so callers can introspect what computeStandings
// returns without crossing module boundaries.
export type { StandingRow }
