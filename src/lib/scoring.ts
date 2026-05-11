// Croatian-rules scoring engine. Pure functions only — same code runs in
// the BE Edge Function and the UI's mock layer.
//
// Mirrors compute_points_for_match in 00018_simplify_scoring.sql.
// If you change scoring rules here, change that migration too.

import {
  type Booster,
  type PointsBreakdown,
  type Prediction,
  boosterMultiplier,
} from '@/types'

type Score = { home: number; away: number }
type Outcome = 'home' | 'draw' | 'away'

function outcome(s: Score): Outcome {
  if (s.home > s.away) return 'home'
  if (s.home < s.away) return 'away'
  return 'draw'
}

// Outcome-rarity bonus.
//
// Rule (in priority order):
//   1. Lone caller — `matchingCount <= 1` → +3.
//      Honours small leagues where the % rule alone would never fire
//      (in a 10-person league, one matching pick is 10%, too common
//      under the old <5% cliff).
//   2. < 5% of the league matched → +3.
//   3. <= 15% matched → +1.
//   4. otherwise → 0.
function rarityBonus(
  matchingCount: number,
  memberCount: number,
): 0 | 1 | 3 {
  if (matchingCount <= 1) return 3
  if (memberCount === 0) return 0
  const pct = (matchingCount / memberCount) * 100
  if (pct < 5) return 3
  if (pct <= 15) return 1
  return 0
}

// Stats describing how rare a prediction is among all predictions for
// a match. Counts include the predictor themselves.
export type PredictionRarity = {
  // Number of league members (including caller) who picked the same
  // final outcome (W/D/L).
  sameOutcomeCount: number
  // Number of league members who picked the same exact score. Kept
  // for the live-match audit display; no longer drives any bonus.
  sameExactCount: number
  // Total league members — the denominator. Non-predictors count too
  // (implicitly "wrong outcome").
  memberCount: number
}

export function computeRarity(
  prediction: Pick<Prediction, 'homeScore' | 'awayScore'>,
  allPredictions: ReadonlyArray<Pick<Prediction, 'homeScore' | 'awayScore'>>,
  memberCount: number,
): PredictionRarity {
  if (memberCount === 0) {
    return { sameOutcomeCount: 0, sameExactCount: 0, memberCount: 0 }
  }
  const myOut = outcome({ home: prediction.homeScore, away: prediction.awayScore })

  let sameOutcome = 0
  let sameExact = 0
  for (const p of allPredictions) {
    const pOut = outcome({ home: p.homeScore, away: p.awayScore })
    if (pOut === myOut) sameOutcome++
    if (
      p.homeScore === prediction.homeScore &&
      p.awayScore === prediction.awayScore
    ) {
      sameExact++
    }
  }
  return {
    sameOutcomeCount: sameOutcome,
    sameExactCount: sameExact,
    memberCount,
  }
}

export type ScoreInput = {
  prediction: { homeScore: number; awayScore: number; booster: Booster | null }
  finalScore: Score
  rarity: PredictionRarity
  // Whether the underlying match has actually finished (vs. live snapshot).
  final: boolean
}

export function computePoints({
  prediction,
  finalScore,
  rarity,
  final,
}: ScoreInput): PointsBreakdown {
  const predOutcome = outcome({
    home: prediction.homeScore,
    away: prediction.awayScore,
  })
  const actualOutcome = outcome(finalScore)

  const exact =
    prediction.homeScore === finalScore.home &&
    prediction.awayScore === finalScore.away
  const correctOutcome = predOutcome === actualOutcome

  let base: PointsBreakdown['base'] = 0
  if (exact) base = 4
  else if (correctOutcome) base = 1

  const outcomeBonus: PointsBreakdown['outcomeBonus'] = correctOutcome
    ? rarityBonus(rarity.sameOutcomeCount, rarity.memberCount)
    : 0
  // Exact-score rarity bonus permanently disabled — exact still earns
  // the +4 base. See 00018_simplify_scoring.sql.
  const exactBonus: PointsBreakdown['exactBonus'] = 0

  const multiplier = boosterMultiplier(prediction.booster)
  const total = (base + outcomeBonus + exactBonus) * multiplier

  return { base, outcomeBonus, exactBonus, multiplier, total, final }
}
