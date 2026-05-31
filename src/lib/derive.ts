// Pure derivations on entity arrays. Same logic the mock layer uses,
// generalised to accept its inputs as parameters so the real Supabase
// api can call it with rows fetched from Postgres.
//
// No I/O here. If you need more fields, fetch them in the api layer
// and add them to the input shape.

import type {
  BoosterCounts,
  CompletedMatchSummary,
  LeagueMember,
  LiveMatchSummary,
  Match,
  PointsBreakdown,
  Prediction,
  PredictionWithDetails,
  Profile,
  StandingRow,
  UpcomingMatchSummary,
  UUID,
} from '@/types'
import { computePoints, computeRarity } from '@/lib/scoring'

// ── Points ──────────────────────────────────────────────────────────────────

/**
 * Compute points for one prediction. Returns null if the match hasn't
 * started yet.
 *
 * For finished matches, prefers the persisted `points` row (server-
 * authoritative — the SQL trigger populated it with the canonical
 * rarity numbers and audit data). Falls back to live recomputation if
 * the row hasn't landed yet (race window, ~30s after status flip).
 *
 * For live matches, always recomputes from current score + peer picks.
 * Live points are inherently provisional — peer predictions are locked
 * but the score moves.
 *
 * `memberCount` is the league member count, which is the rarity
 * denominator under the inclusive rule (members who didn't predict
 * still count).
 */
export function computePredictionPoints(
  prediction: Prediction,
  match: Match,
  peers: Prediction[],
  memberCount: number,
): PointsBreakdown | null {
  if (match.status === 'scheduled') return null

  // Server-stored points are the source of truth for finished matches.
  if (match.status === 'finished' && prediction.storedPoints) {
    return prediction.storedPoints
  }

  if (match.homeScore === null || match.awayScore === null) return null
  const rarity = computeRarity(prediction, peers, memberCount)
  return computePoints({
    prediction,
    finalScore: { home: match.homeScore, away: match.awayScore },
    rarity,
    final: match.status === 'finished',
  })
}

// ── Match-state helpers ─────────────────────────────────────────────────────

/**
 * A match is "upcoming and predictable" only if its status is still
 * 'scheduled' AND its kickoff_time hasn't passed. The two conditions are
 * intentionally redundant — between kickoff and the next sync-live tick
 * a match can sit in a zombie state where status is stale; treating it
 * as predictable would surface an avoidable RLS error on submit, since
 * the predictions_*_pre_kickoff policies enforce kickoff_time > now() at
 * the DB level.
 *
 * Use this everywhere upcoming matches are displayed or filtered.
 */
export function isUpcomingPredictable(match: Match, now: number = Date.now()): boolean {
  if (match.status !== 'scheduled') return false
  return new Date(match.kickoffTime).getTime() > now
}

// ── Boosters ────────────────────────────────────────────────────────────────

export function boosterUsage(
  predictions: Prediction[],
  pool: BoosterCounts,
): { used: BoosterCounts; remaining: BoosterCounts; totalUsed: number } {
  const used: BoosterCounts = { x2: 0, x3: 0, x5: 0 }
  for (const p of predictions) {
    if (p.booster) used[p.booster] += 1
  }
  const remaining: BoosterCounts = {
    x2: Math.max(0, pool.x2 - used.x2),
    x3: Math.max(0, pool.x3 - used.x3),
    x5: Math.max(0, pool.x5 - used.x5),
  }
  return { used, remaining, totalUsed: used.x2 + used.x3 + used.x5 }
}

// ── Standings ───────────────────────────────────────────────────────────────

/**
 * Compute the full standings for a league. Inputs are scoped to that
 * league only — caller is responsible for filtering predictions to the
 * single `leagueId`.
 *
 * `currentUserId` is used to flag the row that represents "me" so UI
 * consumers can highlight it without name-based heuristics.
 * `beforeSnapshot` maps userId → position before today's live matches
 * began. If absent, positionChange is 0 for everyone.
 */
export function computeStandings(args: {
  members: LeagueMember[]
  matches: Match[]
  predictions: Prediction[]
  leaguePool: BoosterCounts
  currentUserId?: UUID
  beforeSnapshot?: Record<UUID, number>
}): StandingRow[] {
  const {
    members,
    matches,
    predictions,
    leaguePool,
    currentUserId,
    beforeSnapshot,
  } = args
  const matchById = new Map(matches.map((m) => [m.id, m]))
  // Pre-bucket peers per match for O(1) rarity lookups.
  const peersByMatch = new Map<UUID, Prediction[]>()
  for (const p of predictions) {
    const arr = peersByMatch.get(p.matchId) ?? []
    arr.push(p)
    peersByMatch.set(p.matchId, arr)
  }

  const rows: StandingRow[] = members.map((m) => {
    let totalPoints = 0
    let matchdayPoints = 0
    let exactScores = 0
    const userPredictions: Prediction[] = []

    for (const p of predictions) {
      if (p.userId !== m.userId) continue
      userPredictions.push(p)
      const match = matchById.get(p.matchId)
      if (!match) continue
      const peers = peersByMatch.get(p.matchId) ?? []
      const pts = computePredictionPoints(p, match, peers, members.length)
      if (!pts) continue
      if (match.status === 'finished') {
        totalPoints += pts.total
        if (pts.base === 4) exactScores += 1
      } else if (match.status === 'live') {
        matchdayPoints += pts.total
      }
    }

    const usage = boosterUsage(userPredictions, leaguePool)
    return {
      position: 0,
      profile: m.profile,
      isCurrentUser: m.userId === currentUserId,
      totalPoints,
      matchdayPoints,
      exactScores,
      boostersUsed: usage.totalUsed,
      boostersRemaining: usage.remaining,
      positionChange: 0,
    }
  })

  // Combined points desc, exactScores tiebreaker.
  rows.sort((a, b) => {
    const at = a.totalPoints + a.matchdayPoints
    const bt = b.totalPoints + b.matchdayPoints
    if (bt !== at) return bt - at
    return b.exactScores - a.exactScores
  })

  rows.forEach((r, idx) => {
    r.position = idx + 1
    if (beforeSnapshot) {
      const before = beforeSnapshot[r.profile.id]
      r.positionChange = before ? before - r.position : 0
    }
  })

  return rows
}

// ── Match summaries ────────────────────────────────────────────────────────

export function liveMatchSummary(args: {
  match: Match
  predictions: Prediction[]
  userId: UUID
  profileById: Map<UUID, Profile>
  memberCount: number
}): LiveMatchSummary {
  const { match, predictions, userId, profileById, memberCount } = args
  const ranked = predictions
    .map((p) => toDetailed(p, match, predictions, profileById, memberCount))
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

export function upcomingMatchSummary(args: {
  match: Match
  userPrediction: Prediction | null
}): UpcomingMatchSummary {
  return {
    match: args.match,
    userPrediction: args.userPrediction,
  }
}

export function completedMatchSummary(args: {
  match: Match
  predictions: Prediction[]
  userId: UUID
  profileById: Map<UUID, Profile>
  memberCount: number
}): CompletedMatchSummary {
  const { match, predictions, userId, profileById, memberCount } = args
  const userPred = predictions.find((p) => p.userId === userId) ?? null
  return {
    match,
    userPrediction: userPred
      ? toDetailed(userPred, match, predictions, profileById, memberCount)
      : null,
  }
}

function toDetailed(
  prediction: Prediction,
  match: Match,
  peers: Prediction[],
  profileById: Map<UUID, Profile>,
  memberCount: number,
): PredictionWithDetails {
  return {
    ...prediction,
    profile:
      profileById.get(prediction.userId) ??
      ({ id: prediction.userId, displayName: '?', avatarUrl: null } as Profile),
    points: computePredictionPoints(prediction, match, peers, memberCount),
  }
}

// ── League utilities ────────────────────────────────────────────────────────

/**
 * A league is finished only when it has matches AND none are still
 * scheduled or live. Match status is the authoritative signal — the
 * football-data sync's `season_end` metadata can sit *before* the actual
 * final (e.g. UEFA's seasonEnd may end May, while the Champions League
 * final is in June). Trusting seasonEnd makes the league disappear from
 * the dashboard and blocks predictions on the still-unplayed final.
 *
 * Empty `matches` (no fixtures synced yet) defensively returns false:
 * better to keep an orphan league visible than to silently hide it.
 */
export function isLeagueFinished(matches: Match[]): boolean {
  if (matches.length === 0) return false
  return matches.every((m) => m.status === 'finished')
}
