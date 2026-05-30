// Pure derivations on top of fixtures. Mirrors what real BE queries / RPCs
// will compute. No I/O — keeps it testable and identical to BE intent.

import type {
  BestScoreSuggestion,
  BoosterCounts,
  CompletedMatchSummary,
  LeagueDashboardSummary,
  LeagueDetailPayload,
  LeagueMember,
  LeaguePredictionContext,
  LiveMatchSummary,
  Match,
  MatchDetailPayload,
  MyLeagueCard,
  MyLeaguesPayload,
  Prediction,
  PredictionContextPayload,
  PredictionWithDetails,
  PointsBreakdown,
  Profile,
  StandingRow,
  UpcomingMatchSummary,
  UUID,
} from '@/types'
import { boosterMultiplier } from '@/types'
import { computePoints, computeRarity } from '@/lib/scoring'
import {
  CURRENT_USER_ID,
  leagueMembers,
  leagues,
  matches as allMatches,
  predictions as allPredictions,
  profiles,
  standingsBefore,
} from './fixtures'

// ── Lookups ──────────────────────────────────────────────────────────────────

function getProfile(userId: UUID): Profile {
  return (
    profiles[userId] ??
    ({ id: userId, displayName: userId, avatarUrl: null } as Profile)
  )
}

function predictionsForMatchAndLeague(matchId: UUID, leagueId: UUID): Prediction[] {
  return allPredictions.filter(
    (p) => p.matchId === matchId && p.leagueId === leagueId,
  )
}

function userPrediction(
  userId: UUID,
  matchId: UUID,
  leagueId: UUID,
): Prediction | null {
  return (
    allPredictions.find(
      (p) =>
        p.userId === userId && p.matchId === matchId && p.leagueId === leagueId,
    ) ?? null
  )
}

// ── Points computation for a single prediction ──────────────────────────────

function computePredictionPoints(
  prediction: Prediction,
  match: Match,
): PointsBreakdown | null {
  if (match.status === 'scheduled') return null
  if (match.homeScore === null || match.awayScore === null) return null

  const peers = predictionsForMatchAndLeague(match.id, prediction.leagueId)
  const memberCount = (leagueMembers[prediction.leagueId] ?? []).length
  const rarity = computeRarity(prediction, peers, memberCount)
  return computePoints({
    prediction,
    finalScore: { home: match.homeScore, away: match.awayScore },
    rarity,
    final: match.status === 'finished',
  })
}

// ── Boosters used / remaining ───────────────────────────────────────────────

function boosterUsage(
  userId: UUID,
  leagueId: UUID,
): { used: BoosterCounts; remaining: BoosterCounts; totalUsed: number } {
  const userPreds = allPredictions.filter(
    (p) => p.userId === userId && p.leagueId === leagueId && p.booster !== null,
  )
  const used: BoosterCounts = { x2: 0, x3: 0, x5: 0 }
  for (const p of userPreds) {
    if (p.booster) used[p.booster] += 1
  }
  const pool = leagues[leagueId].settings.boosters.pool
  const remaining: BoosterCounts = {
    x2: Math.max(0, pool.x2 - used.x2),
    x3: Math.max(0, pool.x3 - used.x3),
    x5: Math.max(0, pool.x5 - used.x5),
  }
  return { used, remaining, totalUsed: used.x2 + used.x3 + used.x5 }
}

// ── Standings ────────────────────────────────────────────────────────────────

export function computeStandings(leagueId: UUID): StandingRow[] {
  const members = leagueMembers[leagueId] ?? []
  const beforeMap = standingsBefore[leagueId] ?? {}

  const rows = members.map((m: LeagueMember): StandingRow => {
    let totalPoints = 0
    let matchdayPoints = 0
    let exactScores = 0

    for (const p of allPredictions) {
      if (p.userId !== m.userId || p.leagueId !== leagueId) continue
      const match = allMatches[p.matchId]
      if (!match) continue
      const pts = computePredictionPoints(p, match)
      if (!pts) continue
      if (match.status === 'finished') {
        totalPoints += pts.total
        if (pts.base === 4) exactScores += 1
      } else if (match.status === 'live') {
        matchdayPoints += pts.total
      }
    }

    const usage = boosterUsage(m.userId, leagueId)
    return {
      position: 0, // filled below
      profile: m.profile,
      isCurrentUser: m.userId === CURRENT_USER_ID,
      totalPoints,
      matchdayPoints,
      exactScores,
      boostersUsed: usage.totalUsed,
      boostersRemaining: usage.remaining,
      positionChange: 0, // filled below
    }
  })

  // Sort: combined points desc, then exactScores tiebreaker.
  rows.sort((a, b) => {
    const at = a.totalPoints + a.matchdayPoints
    const bt = b.totalPoints + b.matchdayPoints
    if (bt !== at) return bt - at
    return b.exactScores - a.exactScores
  })

  // Assign positions and compute change vs. snapshot.
  rows.forEach((r, idx) => {
    r.position = idx + 1
    const before = beforeMap[r.profile.id]
    r.positionChange = before ? before - r.position : 0
  })

  return rows
}

// ── Match summaries ─────────────────────────────────────────────────────────

function liveMatchSummary(
  match: Match,
  leagueId: UUID,
  userId: UUID,
): LiveMatchSummary {
  const peers = predictionsForMatchAndLeague(match.id, leagueId)
  const ranked = peers
    .map((p) => toDetailed(p, match))
    .sort(
      (a, b) =>
        (b.points?.total ?? 0) - (a.points?.total ?? 0) ||
        a.profile.displayName.localeCompare(b.profile.displayName),
    )
  const userPred = ranked.find((p) => p.userId === userId) ?? null
  return {
    match,
    predictionCount: ranked.length,
    userPrediction: userPred,
    rankedPredictions: ranked,
  }
}

function upcomingMatchSummary(
  match: Match,
  leagueId: UUID,
  userId: UUID,
): UpcomingMatchSummary {
  return {
    match,
    userPrediction: userPrediction(userId, match.id, leagueId),
  }
}

function completedMatchSummary(
  match: Match,
  leagueId: UUID,
  userId: UUID,
): CompletedMatchSummary {
  const userPred = userPrediction(userId, match.id, leagueId)
  return {
    match,
    userPrediction: userPred ? toDetailed(userPred, match) : null,
  }
}

function toDetailed(
  prediction: Prediction,
  match: Match,
): PredictionWithDetails {
  return {
    ...prediction,
    profile: getProfile(prediction.userId),
    points: computePredictionPoints(prediction, match),
  }
}

// ── Per-league: matches grouped by status ────────────────────────────────────

function matchesForLeague(leagueId: UUID): {
  live: Match[]
  upcoming: Match[]
  completed: Match[]
} {
  // Mock leagues link to exactly one competition, so the "primary" link
  // is the only link. Real multi-comp leagues would iterate.
  const competitionId = leagues[leagueId].competitions[0].competition.id
  const all = Object.values(allMatches).filter(
    (m) => m.competitionId === competitionId,
  )
  return {
    live: all
      .filter((m) => m.status === 'live')
      .sort((a, b) => a.kickoffTime.localeCompare(b.kickoffTime)),
    upcoming: all
      .filter((m) => m.status === 'scheduled')
      .sort((a, b) => a.kickoffTime.localeCompare(b.kickoffTime)),
    completed: all
      .filter((m) => m.status === 'finished')
      .sort((a, b) => b.kickoffTime.localeCompare(a.kickoffTime)),
  }
}

// ── Public payload builders ─────────────────────────────────────────────────

export function buildDashboard(userId: UUID = CURRENT_USER_ID): LeagueDashboardSummary[] {
  const userLeagueIds = Object.values(leagueMembers)
    .flat()
    .filter((m) => m.userId === userId)
    .map((m) => m.leagueId)

  const summaries: LeagueDashboardSummary[] = []
  for (const leagueId of userLeagueIds) {
    const league = leagues[leagueId]
    const isCompleted = isCompetitionFinished(leagueId)
    if (isCompleted) continue // dashboard only shows active competitions

    const standings = computeStandings(leagueId)
    const userRow = standings.find((r) => r.profile.id === userId)
    const { live, upcoming } = matchesForLeague(leagueId)

    const liveSummaries = live.map((m) => liveMatchSummary(m, leagueId, userId))
    const upcomingSummaries = upcoming.map((m) =>
      upcomingMatchSummary(m, leagueId, userId),
    )

    const unpredictedCount = upcomingSummaries.filter(
      (u) => u.userPrediction === null,
    ).length

    const top3 = standings.slice(0, 3)
    const userInTop3 = userRow ? top3.includes(userRow) : false
    const standingsPreview =
      userRow && !userInTop3 ? [...top3, userRow] : top3

    summaries.push({
      league,
      userPosition: userRow?.position ?? standings.length + 1,
      userTotalPoints:
        (userRow?.totalPoints ?? 0) + (userRow?.matchdayPoints ?? 0),
      userMatchdayPoints: userRow?.matchdayPoints ?? 0,
      userBoostersRemaining:
        userRow?.boostersRemaining ?? league.settings.boosters.pool,
      liveMatches: liveSummaries,
      upcomingMatches: upcomingSummaries,
      unpredictedCount,
      standingsPreview,
    })
  }
  return summaries
}

export function buildMyLeagues(userId: UUID = CURRENT_USER_ID): MyLeaguesPayload {
  const userLeagueIds = Object.values(leagueMembers)
    .flat()
    .filter((m) => m.userId === userId)
    .map((m) => m.leagueId)

  const cards: MyLeagueCard[] = userLeagueIds.map((leagueId): MyLeagueCard => {
    const league = leagues[leagueId]
    const standings = computeStandings(leagueId)
    const userRow = standings.find((r) => r.profile.id === userId)
    const userPoints =
      (userRow?.totalPoints ?? 0) + (userRow?.matchdayPoints ?? 0)
    const userPosition = userRow?.position ?? standings.length + 1
    const isCompleted = isCompetitionFinished(leagueId)
    const next = matchesForLeague(leagueId).upcoming[0] ?? null

    let finalBadge: MyLeagueCard['finalBadge'] = null
    if (isCompleted) {
      if (userPosition === 1) finalBadge = '1st'
      else if (userPosition === 2) finalBadge = '2nd'
      else if (userPosition === 3) finalBadge = '3rd'
    }

    return {
      league,
      userPosition,
      userPoints,
      nextMatchKickoff: next?.kickoffTime ?? null,
      isCompleted,
      finalBadge,
    }
  })

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

export function buildLeagueDetail(
  leagueId: UUID,
  userId: UUID = CURRENT_USER_ID,
): LeagueDetailPayload | null {
  const league = leagues[leagueId]
  if (!league) return null

  const { live, upcoming, completed } = matchesForLeague(leagueId)

  const isAdmin = (leagueMembers[leagueId] ?? []).some(
    (m) => m.userId === userId && m.role === 'admin',
  )

  return {
    league,
    isAdmin,
    members: leagueMembers[leagueId] ?? [],
    standings: computeStandings(leagueId),
    liveMatches: live.map((m) => liveMatchSummary(m, leagueId, userId)),
    upcomingMatches: upcoming.map((m) => upcomingMatchSummary(m, leagueId, userId)),
    completedMatches: completed.map((m) => completedMatchSummary(m, leagueId, userId)),
  }
}

export function buildMatchDetail(
  matchId: UUID,
  leagueId: UUID,
  userId: UUID = CURRENT_USER_ID,
): MatchDetailPayload | null {
  const match = allMatches[matchId]
  const league = leagues[leagueId]
  if (!match || !league) return null

  const peers = predictionsForMatchAndLeague(matchId, leagueId)

  // Blind-prediction rule: pre-kickoff, only the user's own prediction is
  // visible. Mock enforces this so the UI handles both states correctly.
  const isLocked = match.status !== 'scheduled'
  const visiblePredictions: Prediction[] = isLocked
    ? peers
    : peers.filter((p) => p.userId === userId)

  const detailed = visiblePredictions.map((p) => toDetailed(p, match))
  const userPred = detailed.find((p) => p.userId === userId) ?? null

  return {
    match,
    league: { id: league.id, name: league.name },
    predictions: detailed,
    userPrediction: userPred,
    bestScoresForUser: isLocked
      ? buildBestScoresForUser(match, peers, userId, leagueId)
      : [],
    standings: computeStandings(leagueId),
  }
}

export function buildPredictionContext(
  matchId: UUID,
  userId: UUID = CURRENT_USER_ID,
): PredictionContextPayload | null {
  const match = allMatches[matchId]
  if (!match) return null

  // Find every league the user is in whose competition matches this match's.
  const userLeagueIds = Object.values(leagueMembers)
    .flat()
    .filter((m) => m.userId === userId)
    .map((m) => m.leagueId)

  const contexts: LeaguePredictionContext[] = []
  for (const leagueId of userLeagueIds) {
    const league = leagues[leagueId]
    if (
      !league.competitions.some(
        (lc) => lc.competition.id === match.competitionId,
      )
    ) {
      continue
    }
    if (isCompetitionFinished(leagueId)) continue

    const standings = computeStandings(leagueId)
    const userRow = standings.find((r) => r.profile.id === userId)
    const leader = standings[0]
    const leaderGap = userRow && leader
      ? leader.totalPoints + leader.matchdayPoints
        - (userRow.totalPoints + userRow.matchdayPoints)
      : 0

    contexts.push({
      leagueId,
      leagueName: league.name,
      leagueIcon: league.icon,
      currentPosition: userRow?.position ?? standings.length + 1,
      currentPoints: (userRow?.totalPoints ?? 0) + (userRow?.matchdayPoints ?? 0),
      leaderGap,
      currentPrediction: userPrediction(userId, matchId, leagueId),
      boostersEnabled: league.settings.boosters.enabled,
      boostersRemaining: userRow?.boostersRemaining ?? league.settings.boosters.pool,
    })
  }
  return { match, leagues: contexts }
}

// ── "Best for You" ──────────────────────────────────────────────────────────
//
// Given the current live score, compute the top 3 hypothetical exact scores
// that would maximize the user's points if the match ended right now,
// considering rarity vs. the current league predictions.

function buildBestScoresForUser(
  match: Match,
  peers: Prediction[],
  userId: UUID,
  leagueId: UUID,
): BestScoreSuggestion[] {
  if (match.homeScore === null || match.awayScore === null) return []
  const userPred = peers.find((p) => p.userId === userId)
  if (!userPred) return []

  const memberCount = (leagueMembers[leagueId] ?? []).length
  const candidates: Array<{ home: number; away: number; pts: PointsBreakdown }> =
    []

  // Search a small grid of plausible scores.
  for (let h = 0; h <= 5; h++) {
    for (let a = 0; a <= 5; a++) {
      const hypothetical = {
        homeScore: h,
        awayScore: a,
        booster: userPred.booster,
      }
      const rarity = computeRarity(
        { homeScore: h, awayScore: a },
        peers,
        memberCount,
      )
      const pts = computePoints({
        prediction: hypothetical,
        finalScore: { home: match.homeScore, away: match.awayScore },
        rarity,
        final: false,
      })
      candidates.push({ home: h, away: a, pts })
    }
  }

  // Top 3 by total points, prefer including the user's actual pick.
  candidates.sort((a, b) => b.pts.total - a.pts.total)
  const top = candidates.slice(0, 3)

  return top.map((c) => ({
    homeScore: c.home,
    awayScore: c.away,
    isCurrentScore:
      c.home === match.homeScore && c.away === match.awayScore,
    hypotheticalPoints: c.pts,
    reasoning: explainPoints(c.pts),
  }))
}

function explainPoints(pts: PointsBreakdown): string {
  if (pts.total === 0) return 'Wrong outcome, no points'
  const parts: string[] = []
  if (pts.base === 4) parts.push('4 exact')
  else if (pts.base === 1) parts.push('1 outcome')
  if (pts.outcomeBonus > 0) parts.push(`+${pts.outcomeBonus} outcome rarity`)
  if (pts.exactBonus > 0) parts.push(`+${pts.exactBonus} exact rarity`)
  const sum = parts.join(' + ')
  return pts.multiplier > 1 ? `(${sum}) ×${pts.multiplier} booster` : sum
}

// ── Helpers ──────────────────────────────────────────────────────────────────

// A league is finished only when its matches are all played — match
// status is the truth, season_end metadata can sit before the actual
// final (e.g. UEFA cup finals after season end). Empty fixtures (new
// league) defensively counts as active.
function isCompetitionFinished(leagueId: UUID): boolean {
  const buckets = matchesForLeague(leagueId)
  return (
    buckets.live.length === 0 &&
    buckets.upcoming.length === 0 &&
    buckets.completed.length > 0
  )
}

export { boosterMultiplier }
