// Maps football-data.org "stage" + matchday into our `rounds` rows.
//
// CUP competitions: round name comes from stage (Group Stage, Round of 16, ...)
// LEAGUE competitions: round name is per-matchday ("Matchday 12") so the
//   UI can group fixtures naturally; the matchday integer is also stored
//   on the match itself for sorting.

export type CompetitionType = 'CUP' | 'LEAGUE'

const STAGE_NAMES: Record<string, { name: string; sortOrder: number }> = {
  GROUP_STAGE:           { name: 'Group Stage',     sortOrder: 1 },
  PRELIMINARY_ROUND:     { name: 'Preliminary',     sortOrder: 0 },
  ROUND_1:               { name: 'Round 1',         sortOrder: 1 },
  ROUND_2:               { name: 'Round 2',         sortOrder: 2 },
  PLAY_OFF_ROUND:        { name: 'Play-off',        sortOrder: 1 },
  PLAY_OFF_ROUND_FINALS: { name: 'Play-off Final',  sortOrder: 2 },
  LAST_16:               { name: 'Round of 16',     sortOrder: 2 },
  ROUND_OF_16:           { name: 'Round of 16',     sortOrder: 2 },
  QUARTER_FINALS:        { name: 'Quarter Finals',  sortOrder: 3 },
  SEMI_FINALS:           { name: 'Semi Finals',     sortOrder: 4 },
  THIRD_PLACE:           { name: 'Third Place',     sortOrder: 5 },
  FINAL:                 { name: 'Final',           sortOrder: 6 },
}

export type RoundDescriptor = { name: string; sortOrder: number }

export function deriveRound(
  competitionType: CompetitionType,
  stage: string | null,
  matchday: number | null,
): RoundDescriptor {
  if (competitionType === 'LEAGUE' && matchday != null) {
    return { name: `Matchday ${matchday}`, sortOrder: matchday }
  }
  if (stage && STAGE_NAMES[stage]) return STAGE_NAMES[stage]
  // Unknown stage — fall back to the raw label so it's at least visible.
  return { name: humanize(stage ?? 'Unknown'), sortOrder: 99 }
}

function humanize(s: string): string {
  return s
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}
