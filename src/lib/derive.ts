// Pure derivations on entity arrays. Same logic the mock layer uses,
// generalised to accept its inputs as parameters so the real Supabase
// api can call it with rows fetched from Postgres.
//
// No I/O here. If you need more fields, fetch them in the api layer
// and add them to the input shape.

import type {
  Booster,
  BoosterCounts,
  CompletedMatchSummary,
  LeagueMember,
  LiveMatchSummary,
  Match,
  MatchOverview,
  MatchScenario,
  Moment,
  MomentFeedItem,
  MomentKind,
  MomentRarity,
  MomentViewer,
  PointsBreakdown,
  Prediction,
  PredictionGroup,
  PredictionWithDetails,
  Profile,
  ScoreSlice,
  StandingRow,
  UpcomingMatchSummary,
  UUID,
} from '@/types'
import { computePoints, computeRarity, resultOutcome } from '@/lib/scoring'

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
    .map((p) =>
      toDetailedPrediction(p, match, predictions, profileById, memberCount),
    )
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
      ? toDetailedPrediction(
          userPred,
          match,
          predictions,
          profileById,
          memberCount,
        )
      : null,
  }
}

// Map a raw prediction → PredictionWithDetails (profile + points). Shared by
// the summary builders, getMatchDetail, and the moments feed so they all
// resolve points the same way (persisted row for finished, recompute live).
export function toDetailedPrediction(
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

// ── Moments (match stories) ──────────────────────────────────────────────────
//
// A finished match always yields a MatchOverview (the "what happened for all
// players" floor) and zero or more standout Moments. All inputs are already
// fetched elsewhere (predictions carry their persisted points + audit fields),
// so these are pure and need no I/O.

// Magnitude at which the single biggest total of a match is worth its own
// "haul" moment (e.g. exact 4 + rare outcome 3, or a boosted exact).
const HAUL_THRESHOLD = 8

// A booster only headlines when it genuinely paid off big — a x2-on-exact (8)
// or a x3+ haul — not a x2/x3 stacked on a plain correct outcome (+2/+3),
// which reads weak against the match's real story.
const BOOSTER_MIN_TOTAL = 6

// A finished match is an "upset" when only a small fraction of those who
// predicted got the outcome right — the league-wide "almost nobody saw it".
const UPSET_MAX_RATIO = 0.25

// Base weight per kind: exact tops ties (the brand mechanic); a *rare* exact
// still beats a common one via the rarity term below. Collective/mover sit low
// so they only headline a match that produced nothing flashier.
const KIND_WEIGHT: Record<MomentKind, number> = {
  exact: 10,
  contrarian: 8,
  haul: 7,
  booster: 6,
  mover: 5,
  collective: 4,
}

// Points scored carry the most weight: a big haul should be able to out-rank a
// low-value exact. The kind weight is a head start (exact's brand bonus), but
// magnitude dominates — so "+12" beats a "+4 on the nose".
const POINTS_WEIGHT = 1
const POINTS_CAP = 40

function severity(
  kind: MomentKind,
  opts: { points?: number; outcomePct?: number } = {},
): number {
  const magnitude = Math.min(opts.points ?? 0, POINTS_CAP) * POINTS_WEIGHT
  const rarity =
    opts.outcomePct != null ? (10 - Math.min(opts.outcomePct, 10)) * 0.4 : 0
  return KIND_WEIGHT[kind] + magnitude + rarity
}

// Rarity for a prediction: prefer the persisted audit fields (canonical), fall
// back to recomputing during the post-finish race window where points is null.
function rarityOf(
  p: PredictionWithDetails,
  all: PredictionWithDetails[],
  memberCount: number,
): MomentRarity {
  const pts = p.points
  if (pts?.memberCount != null) {
    return {
      sameOutcomeCount: pts.sameOutcomeCount ?? 0,
      memberCount: pts.memberCount,
      outcomePct: pts.outcomePct ?? 0,
    }
  }
  const r = computeRarity(p, all, memberCount)
  const pct = r.memberCount ? (r.sameOutcomeCount / r.memberCount) * 100 : 0
  return {
    sameOutcomeCount: r.sameOutcomeCount,
    memberCount: r.memberCount,
    outcomePct: pct,
  }
}

/**
 * The always-on league roll-up for a finished match: participation, the
 * home/draw/away split, the consensus team, correct/exact counts and the top
 * haul. Runs for every finished match with predictions — the feed floor.
 */
export function deriveMatchOverview(args: {
  match: Match
  predictions: PredictionWithDetails[]
  memberCount: number
}): MatchOverview {
  const { match, predictions, memberCount } = args
  let homeCount = 0
  let drawCount = 0
  let awayCount = 0
  let correctCount = 0
  let exactCount = 0
  let topPoints = 0
  let topScorer: Profile | null = null

  for (const p of predictions) {
    const out = resultOutcome(p.homeScore, p.awayScore)
    if (out === 'home') homeCount++
    else if (out === 'away') awayCount++
    else drawCount++

    const b = p.points?.base ?? 0
    if (b >= 1) correctCount++
    if (b === 4) exactCount++

    const t = p.points?.total ?? 0
    if (t > topPoints) {
      topPoints = t
      topScorer = p.profile
    }
  }

  // Consensus = modal side; tie-break home > away > draw (array order).
  let consensus: MatchOverview['consensus'] = null
  if (predictions.length > 0) {
    const sides: NonNullable<MatchOverview['consensus']>[] = [
      { side: 'home', count: homeCount, team: match.homeTeam },
      { side: 'away', count: awayCount, team: match.awayTeam },
      { side: 'draw', count: drawCount, team: null },
    ]
    consensus = sides.reduce((best, s) => (s.count > best.count ? s : best))
  }

  return {
    memberCount,
    predictionCount: predictions.length,
    homeCount,
    drawCount,
    awayCount,
    correctCount,
    exactCount,
    topPoints,
    topScorer,
    consensus,
  }
}

/**
 * Standout Moments for a finished match (empty for unfinished / unpredicted).
 * Returns them severity-desc. `mover` is intentionally not produced here — it
 * needs cross-match standings deltas the caller doesn't supply (deferred).
 */
export function deriveMatchMoments(args: {
  match: Match
  predictions: PredictionWithDetails[]
  memberCount: number
  league: { id: UUID; name: string; icon: string | null }
}): Moment[] {
  const { match, predictions, memberCount, league } = args
  if (
    match.status !== 'finished' ||
    match.homeScore == null ||
    match.awayScore == null ||
    predictions.length === 0
  ) {
    return []
  }

  const base = (p: PredictionWithDetails) => p.points?.base ?? 0
  const total = (p: PredictionWithDetails) => p.points?.total ?? 0
  const correct = predictions.filter((p) => base(p) >= 1)
  const exacts = predictions.filter((p) => base(p) === 4)
  const scoreline = `${match.homeScore}–${match.awayScore}`

  const moments: Moment[] = []
  const make = (m: Omit<Moment, 'matchId' | 'league' | 'match'>): Moment => ({
    ...m,
    matchId: match.id,
    league,
    match,
  })

  // Each player stars in at most one standout — their highest-value angle —
  // so the story list never repeats the same name. Priority follows kind
  // weight: exact > contrarian > haul > booster.
  const starred = new Set<UUID>()

  // 🎯 exact — the brand mechanic. A *boosted* exact is a story on its own and
  // must stand out even when several players nailed the score ("3 Eksakts — but
  // Sam went big with ×5").
  if (exacts.length > 0) {
    const sorted = [...exacts].sort(
      (a, b) =>
        total(b) - total(a) ||
        a.profile.displayName.localeCompare(b.profile.displayName),
    )
    const top = sorted[0]
    const topMult = top.points?.multiplier ?? 1
    exacts.forEach((p) => starred.add(p.userId))

    if (topMult > 1) {
      // Boosted exact: feature the player + multiplier, with the Eksakt count
      // as context when there were several. Big points → high severity, so it
      // headlines the match.
      const note = exacts.length > 1 ? `${exacts.length} Eksakts — ` : ''
      moments.push(
        make({
          kind: 'exact',
          actor: top.profile,
          points: total(top),
          booster: top.booster ?? undefined,
          headline: `${note}${top.profile.displayName} went big with ×${topMult}`,
          subtext: `Nailed ${scoreline} · +${total(top)}`,
          severity: severity('exact', { points: total(top) }) + 1,
        }),
      )
    } else if (exacts.length === 1) {
      moments.push(
        make({
          kind: 'exact',
          actor: top.profile,
          points: total(top),
          headline: `${top.profile.displayName} nailed it`,
          subtext: `${scoreline} on the nose · +${total(top)}`,
          severity: severity('exact', { points: total(top) }),
        }),
      )
    } else {
      moments.push(
        make({
          kind: 'exact',
          actors: exacts.map((p) => p.profile),
          points: total(top),
          headline: `${exacts.length} called ${scoreline} exactly`,
          subtext: `Eksakt for ${exacts.length} players`,
          severity: severity('exact', { points: total(top) }) + 0.5,
        }),
      )
    }
  }

  // 🧊 contrarian — a correct call almost nobody else made. Every correct pick
  // shares the one actual outcome, so the rare-outcome callers are a *group*,
  // not a single person — credit them all (e.g. "Barca89 & Kate went against
  // the grain") rather than just the top scorer.
  const contrarians = correct
    .filter((p) => !starred.has(p.userId))
    .map((p) => ({ p, r: rarityOf(p, predictions, memberCount) }))
    .filter(({ r }) => r.outcomePct < 10 || r.sameOutcomeCount <= 1)
    .sort(
      (a, b) =>
        total(b.p) - total(a.p) ||
        a.p.profile.displayName.localeCompare(b.p.profile.displayName),
    )
  if (contrarians.length > 0) {
    const r = contrarians[0].r
    const players = contrarians.map(({ p }) => p)
    players.forEach((p) => starred.add(p.userId))
    const topTotal = total(players[0])
    const names = players.map((p) => p.profile.displayName)
    const headline =
      players.length === 1
        ? `${names[0]} went against the grain`
        : players.length === 2
          ? `${names[0]} & ${names[1]} went against the grain`
          : `${players.length} went against the grain`
    const subtext =
      players.length === 1
        ? r.sameOutcomeCount <= 1
          ? `The only one to call it · +${topTotal}`
          : `Just ${Math.round(r.outcomePct)}% backed it · +${topTotal}`
        : `Just ${Math.round(r.outcomePct)}% backed it`
    moments.push(
      make({
        kind: 'contrarian',
        actor: players.length === 1 ? players[0].profile : undefined,
        actors: players.length > 1 ? players.map((p) => p.profile) : undefined,
        points: topTotal,
        rarity: r,
        headline,
        subtext,
        severity: severity('contrarian', {
          points: topTotal,
          outcomePct: r.outcomePct,
        }),
      }),
    )
  }

  // 🔥 haul — the single biggest total, when it clears the threshold.
  const topPred = predictions.reduce(
    (b, p) => (total(p) > total(b) ? p : b),
    predictions[0],
  )
  if (total(topPred) >= HAUL_THRESHOLD && !starred.has(topPred.userId)) {
    starred.add(topPred.userId)
    moments.push(
      make({
        kind: 'haul',
        actor: topPred.profile,
        points: total(topPred),
        booster: topPred.booster ?? undefined,
        headline: `${topPred.profile.displayName} banked +${total(topPred)}`,
        subtext: topPred.booster
          ? `Biggest haul · ${topPred.booster} booster`
          : 'Biggest haul of the match',
        severity: severity('haul', { points: total(topPred) }),
      }),
    )
  }

  // 🎲 booster — a multiplier gamble that paid off.
  const boosterPick = predictions
    .filter(
      (p) => (p.points?.multiplier ?? 1) > 1 && total(p) >= BOOSTER_MIN_TOTAL,
    )
    .sort(
      (a, b) =>
        (b.points?.multiplier ?? 1) - (a.points?.multiplier ?? 1) ||
        total(b) - total(a),
    )
    .find((p) => !starred.has(p.userId))
  if (boosterPick) {
    starred.add(boosterPick.userId)
    moments.push(
      make({
        kind: 'booster',
        actor: boosterPick.profile,
        points: total(boosterPick),
        booster: boosterPick.booster ?? undefined,
        headline: `${boosterPick.profile.displayName}'s ${boosterPick.booster} paid off`,
        subtext: `+${total(boosterPick)} with the multiplier`,
        severity: severity('booster', { points: total(boosterPick) }),
      }),
    )
  }

  // 👥 collective — whole-league beats. Independent of the standouts above
  // (no single actor), so an upset can sit alongside an exact/contrarian.
  const predCount = predictions.length
  if (correct.length === 0) {
    moments.push(
      make({
        kind: 'collective',
        headline: `Nobody saw ${scoreline} coming`,
        subtext: `All ${predCount} picks missed`,
        severity: severity('collective'),
      }),
    )
  } else if (
    memberCount >= 2 &&
    predCount === memberCount &&
    correct.length === predCount
  ) {
    moments.push(
      make({
        kind: 'collective',
        actors: correct.map((p) => p.profile),
        headline: 'Clean sweep — everyone called it',
        subtext: `All ${memberCount} got the outcome`,
        severity: severity('collective'),
      }),
    )
  } else if (predCount >= 4 && correct.length / predCount <= UPSET_MAX_RATIO) {
    moments.push(
      make({
        kind: 'collective',
        headline: 'An upset few saw coming',
        subtext: `Only ${correct.length} of ${predCount} called it`,
        severity: severity('collective'),
      }),
    )
  }

  return moments.sort((a, b) => b.severity - a.severity)
}

export function pickHeadline(moments: Moment[]): Moment | null {
  if (moments.length === 0) return null
  return moments.reduce((best, m) => (m.severity > best.severity ? m : best))
}

/**
 * Build one feed row for a (match, league): always-on overview + standouts.
 * Returns null only when the match isn't finished — every finished match
 * appears, even one nobody predicted (it yields an overview-only item), so the
 * feed mirrors the full played-games history.
 */
export function toFeedItem(args: {
  match: Match
  predictions: PredictionWithDetails[]
  memberCount: number
  league: { id: UUID; name: string; icon: string | null }
  viewerId?: UUID // when set, attaches that user's own result (Played feed)
}): MomentFeedItem | null {
  const { match, predictions, memberCount, league, viewerId } = args
  if (match.status !== 'finished') return null
  const overview = deriveMatchOverview({ match, predictions, memberCount })
  const moments = deriveMatchMoments({ match, predictions, memberCount, league })

  let viewer: MomentViewer | undefined
  if (viewerId) {
    const mine = predictions.find((p) => p.userId === viewerId)
    const base = mine?.points?.base ?? 0
    viewer = mine
      ? {
          status: base === 4 ? 'exact' : base === 1 ? 'outcome' : 'wrong',
          homeScore: mine.homeScore,
          awayScore: mine.awayScore,
          points: mine.points?.total ?? 0,
        }
      : { status: 'none', homeScore: null, awayScore: null, points: 0 }
  }

  return {
    matchId: match.id,
    league,
    match,
    overview,
    headline: pickHeadline(moments),
    moments,
    kickoffTime: match.kickoffTime,
    viewer,
  }
}

// ── Live-match board + scenarios ──────────────────────────────────────────────
//
// While a match is live, peers' picks are visible and the scorer is pure, so we
// can bring the finished-match "story" energy forward: group who picked what,
// and project how a few plausible final scores would shake out the points. All
// pure — same predictions + memberCount useMatch already returns.

const SIDE_ORDER: Record<'home' | 'away' | 'draw', number> = {
  home: 0,
  away: 1,
  draw: 2,
}

// Modal booster among a set of predictions (most common; null when none boosted
// or on a tie at zero). Drives the slice's pill.
function modalBooster(preds: PredictionWithDetails[]): Booster | null {
  const counts = new Map<Booster, number>()
  for (const p of preds) {
    if (p.booster) counts.set(p.booster, (counts.get(p.booster) ?? 0) + 1)
  }
  let best: Booster | null = null
  let bestN = 0
  for (const [b, n] of counts) {
    if (n > bestN) {
      bestN = n
      best = b
    }
  }
  return best
}

/**
 * Group a match's visible picks by outcome side, then by exact scoreline — the
 * "who picked what" board. Sides ordered by backing count desc (tie-break
 * home > away > draw); scorelines within a side by backer count desc.
 */
export function derivePredictionGroups(args: {
  match: Match
  predictions: PredictionWithDetails[]
}): PredictionGroup[] {
  const { match, predictions } = args
  const bySide: Record<'home' | 'draw' | 'away', PredictionWithDetails[]> = {
    home: [],
    draw: [],
    away: [],
  }
  for (const p of predictions) {
    bySide[resultOutcome(p.homeScore, p.awayScore)].push(p)
  }

  const groups: PredictionGroup[] = []
  for (const side of ['home', 'draw', 'away'] as const) {
    const preds = bySide[side]
    if (preds.length === 0) continue

    // Bucket by exact scoreline.
    const slices = new Map<string, PredictionWithDetails[]>()
    for (const p of preds) {
      const key = `${p.homeScore}-${p.awayScore}`
      const bucket = slices.get(key)
      if (bucket) bucket.push(p)
      else slices.set(key, [p])
    }

    const scorelines: ScoreSlice[] = [...slices.values()]
      .map((bucket) => ({
        homeScore: bucket[0].homeScore,
        awayScore: bucket[0].awayScore,
        players: bucket.map((p) => p.profile),
        booster: modalBooster(bucket),
      }))
      .sort(
        (a, b) =>
          b.players.length - a.players.length ||
          b.homeScore + b.awayScore - (a.homeScore + a.awayScore),
      )

    groups.push({
      side,
      team: side === 'home' ? match.homeTeam : side === 'away' ? match.awayTeam : null,
      count: preds.length,
      scorelines,
    })
  }

  return groups.sort(
    (a, b) => b.count - a.count || SIDE_ORDER[a.side] - SIDE_ORDER[b.side],
  )
}

/**
 * Project one hypothetical final score: re-score every visible pick against it
 * (the real scorer — boosters and rarity included) and build the league story
 * it would produce, reusing deriveMatchOverview / deriveMatchMoments.
 */
export function deriveScenario(args: {
  match: Match
  predictions: PredictionWithDetails[]
  memberCount: number
  league: { id: UUID; name: string; icon: string | null }
  finalScore: { home: number; away: number }
}): MatchScenario {
  const { match, predictions, memberCount, league, finalScore } = args

  // Synthetic finished match so the story engine treats it as decided.
  const synthetic: Match = {
    ...match,
    status: 'finished',
    homeScore: finalScore.home,
    awayScore: finalScore.away,
  }

  // Re-score each pick directly (not computePredictionPoints, which would
  // short-circuit to any persisted/stored row — we want the hypothetical).
  const scored: PredictionWithDetails[] = predictions.map((p) => ({
    ...p,
    points: computePoints({
      prediction: p,
      finalScore,
      rarity: computeRarity(p, predictions, memberCount),
      final: true,
    }),
  }))

  const overview = deriveMatchOverview({ match: synthetic, predictions: scored, memberCount })
  const moments = deriveMatchMoments({
    match: synthetic,
    predictions: scored,
    memberCount,
    league,
  })

  return {
    finalScore,
    side: resultOutcome(finalScore.home, finalScore.away),
    isCurrent:
      match.homeScore === finalScore.home && match.awayScore === finalScore.away,
    overview,
    headline: pickHeadline(moments),
  }
}

/**
 * The two "next goal" scenarios for a live match: who's in for the big points
 * and what needs to happen. From the current score, project the immediate
 * results — the home team scoring (H+1 : A) and the away team scoring
 * (H : A+1) — and, for each, the players who'd nail that exact scoreline
 * (their projected total, boosters and rarity included), sorted biggest-first.
 *
 * Empty unless the match is live with a known score and visible picks. Re-runs
 * on every goal (the score moves).
 */
export function deriveNextGoalScenarios(args: {
  match: Match
  predictions: PredictionWithDetails[]
  memberCount: number
  league: { id: UUID; name: string; icon: string | null }
}): MatchScenario[] {
  const { match, predictions, memberCount, league } = args
  if (match.status !== 'live' || predictions.length === 0) return []
  if (match.homeScore == null || match.awayScore == null) return []

  const h = match.homeScore
  const a = match.awayScore
  const candidates: { finalScore: { home: number; away: number }; scorer: 'home' | 'away' }[] = []
  if (match.homeTeam) candidates.push({ finalScore: { home: h + 1, away: a }, scorer: 'home' })
  if (match.awayTeam) candidates.push({ finalScore: { home: h, away: a + 1 }, scorer: 'away' })

  return candidates.map(({ finalScore, scorer }) => {
    const scenario = deriveScenario({ match, predictions, memberCount, league, finalScore })
    // "In for big points" = whoever picked this exact scoreline; under it they
    // jump from a correct-outcome +1 to the full exact (×booster, ×rarity).
    const winners = predictions
      .filter(
        (p) => p.homeScore === finalScore.home && p.awayScore === finalScore.away,
      )
      .map((p) => ({
        profile: p.profile,
        points: computePoints({
          prediction: p,
          finalScore,
          rarity: computeRarity(p, predictions, memberCount),
          final: true,
        }).total,
        booster: p.booster ?? null,
      }))
      .sort(
        (x, y) =>
          y.points - x.points ||
          x.profile.displayName.localeCompare(y.profile.displayName),
      )
    return { ...scenario, scorer, winners }
  })
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
