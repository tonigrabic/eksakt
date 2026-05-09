// Croatian-rules scoring engine. Pure functions only — same code runs in
// the BE Edge Function and the UI's mock layer.

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

function rarityBonus(percentMatching: number): 0 | 1 | 3 {
  if (percentMatching < 5) return 3
  if (percentMatching <= 15) return 1
  return 0
}

// Stats describing how rare a prediction is among all predictions for a match.
export type PredictionRarity = {
  // Percent of league members who predicted the SAME final outcome (W/D/L).
  outcomePercent: number
  // Percent of league members who predicted the EXACT same score.
  exactPercent: number
}

// Rarity is "how many predicted the SAME outcome / score as me", not the
// final outcome — that drives the contrarian-bonus mechanic.
export function computeRarity(
  prediction: Pick<Prediction, 'homeScore' | 'awayScore'>,
  allPredictions: ReadonlyArray<Pick<Prediction, 'homeScore' | 'awayScore'>>,
): PredictionRarity {
  if (allPredictions.length === 0) {
    return { outcomePercent: 0, exactPercent: 0 }
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
  const total = allPredictions.length
  return {
    outcomePercent: (sameOutcome / total) * 100,
    exactPercent: (sameExact / total) * 100,
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
    ? rarityBonus(rarity.outcomePercent)
    : 0
  const exactBonus: PointsBreakdown['exactBonus'] = exact
    ? rarityBonus(rarity.exactPercent)
    : 0

  const multiplier = boosterMultiplier(prediction.booster)
  const total = (base + outcomeBonus + exactBonus) * multiplier

  return { base, outcomeBonus, exactBonus, multiplier, total, final }
}
