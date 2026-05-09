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
  buildBestScores,
  completedMatchSummary,
  computeStandings,
  isCompetitionFinished,
  liveMatchSummary,
  upcomingMatchSummary,
} from '@/lib/derive'
import { computePoints, computeRarity } from '@/lib/scoring'
import type {
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
  StandingRow,
  SubmitPredictionInput,
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

const LEAGUE_SELECT = `
  *,
  competition:competitions(*)
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

async function fetchMatchesForCompetition(
  competitionId: UUID,
): Promise<Match[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('matches')
    .select(MATCH_SELECT)
    .eq('competition_id', competitionId)
    .order('kickoff_time', { ascending: true })
  if (error) throw error
  return (data ?? []).map((r) => rowToMatch(r as Parameters<typeof rowToMatch>[0]))
}

async function fetchPredictionsForLeague(
  leagueId: UUID,
): Promise<Prediction[]> {
  // RLS hides others' predictions for matches that haven't kicked off yet,
  // so this naturally returns: my picks for everything, others' picks only
  // for live/finished matches.
  const supabase = createClient()
  const { data, error } = await supabase
    .from('predictions')
    .select('*')
    .eq('league_id', leagueId)
  if (error) throw error
  return (data ?? []).map(rowToPrediction)
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
    if (isCompetitionFinished({ competition: { seasonEnd: leagueRow.competition.season_end } as League['competition'] })) {
      continue
    }

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
  const matches = await fetchMatchesForCompetition(league.competition.id)
  const predictions = await fetchPredictionsForLeague(leagueId)

  const standings = computeStandings({
    members,
    matches,
    predictions,
    leaguePool: league.settings.boosters.pool,
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
      }),
    )

  const upcomingMatches = matches
    .filter((m) => m.status === 'scheduled')
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
    const matches = await fetchMatchesForCompetition(league.competition.id)
    const predictions = await fetchPredictionsForLeague(leagueRow.id)

    const standings = computeStandings({
      members,
      matches,
      predictions,
      leaguePool: league.settings.boosters.pool,
    })
    const userRow = standings.find((r) => r.profile.id === userId)
    const userPosition = userRow?.position ?? standings.length + 1
    const userPoints =
      (userRow?.totalPoints ?? 0) + (userRow?.matchdayPoints ?? 0)
    const next =
      matches
        .filter((m) => m.status === 'scheduled')
        .sort((a, b) => a.kickoffTime.localeCompare(b.kickoffTime))[0] ?? null

    const completed = isCompetitionFinished(league)
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
  const matches = await fetchMatchesForCompetition(league.competition.id)
  const predictions = await fetchPredictionsForLeague(leagueId)

  const standings = computeStandings({
    members,
    matches,
    predictions,
    leaguePool: league.settings.boosters.pool,
  })
  const profileById = new Map(members.map((m) => [m.userId, m.profile]))

  const live = matches
    .filter((m) => m.status === 'live')
    .sort((a, b) => a.kickoffTime.localeCompare(b.kickoffTime))
  const upcoming = matches
    .filter((m) => m.status === 'scheduled')
    .sort((a, b) => a.kickoffTime.localeCompare(b.kickoffTime))
  const finished = matches
    .filter((m) => m.status === 'finished')
    .sort((a, b) => b.kickoffTime.localeCompare(a.kickoffTime))

  return {
    league,
    standings,
    liveMatches: live.map((match) =>
      liveMatchSummary({
        match,
        predictions: predictions.filter((p) => p.matchId === match.id),
        userId,
        profileById,
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
    .select('*')
    .eq('match_id', matchId)
    .eq('league_id', leagueId)
  if (pErr) throw pErr
  const predictions = (predRows ?? []).map(rowToPrediction)

  // For the standings tab, we need league-wide context.
  const allLeagueMatches = await fetchMatchesForCompetition(
    league.competition.id,
  )
  const allLeaguePredictions = await fetchPredictionsForLeague(leagueId)
  const standings = computeStandings({
    members,
    matches: allLeagueMatches,
    predictions: allLeaguePredictions,
    leaguePool: league.settings.boosters.pool,
  })

  const userPredRaw = predictions.find((p) => p.userId === userId) ?? null
  const isLocked = match.status !== 'scheduled'

  const detailedWithPoints = predictions.map((p) => ({
    ...p,
    profile:
      profileById.get(p.userId) ??
      ({ id: p.userId, displayName: '?', avatarUrl: null } as Profile),
    points:
      !isLocked || match.homeScore == null || match.awayScore == null
        ? null
        : computePoints({
            prediction: {
              homeScore: p.homeScore,
              awayScore: p.awayScore,
              booster: p.booster,
            },
            finalScore: { home: match.homeScore, away: match.awayScore },
            rarity: computeRarity(p, predictions),
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
    bestScoresForUser:
      isLocked && userPredRaw
        ? buildBestScores({ match, peers: predictions, userPrediction: userPredRaw })
        : [],
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
    if (leagueRow.competition.id !== match.competitionId) continue
    if (
      isCompetitionFinished({
        competition: { seasonEnd: leagueRow.competition.season_end } as League['competition'],
      })
    ) {
      continue
    }

    const { league, members } = await fetchLeagueWithCounts(leagueRow.id)
    const matches = await fetchMatchesForCompetition(league.competition.id)
    const predictions = await fetchPredictionsForLeague(leagueRow.id)

    const standings = computeStandings({
      members,
      matches,
      predictions,
      leaguePool: league.settings.boosters.pool,
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

  const inviteCode = Math.random().toString(36).slice(2, 8).toUpperCase()
  const { data: leagueRow, error: lErr } = await supabase
    .from('leagues')
    .insert({
      name: input.name,
      description: input.description,
      invite_code: inviteCode,
      icon: input.icon,
      competition_id: input.competitionId,
      created_by: userId,
      settings: input.settings,
    })
    .select(LEAGUE_SELECT)
    .single()
  if (lErr) throw lErr

  // The creator is automatically the first member, with admin role.
  const { error: mErr } = await supabase.from('league_members').insert({
    league_id: leagueRow!.id,
    user_id: userId,
    role: 'admin',
  })
  if (mErr) throw mErr

  const league = rowToLeague(
    leagueRow as Parameters<typeof rowToLeague>[0],
    1,
  )
  return {
    league,
    inviteUrl: `eksakt.app/join/${league.inviteCode}`,
  }
}

export async function joinLeague(input: JoinLeagueInput): Promise<League> {
  // Wire up when the /invite/[code] flow is implemented.
  throw new Error(`Not implemented yet (invite ${input.inviteCode})`)
}

// Re-export StandingRow so callers can introspect what computeStandings
// returns without crossing module boundaries.
export type { StandingRow }
