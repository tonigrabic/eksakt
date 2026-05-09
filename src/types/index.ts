// Canonical domain types shared by UI and (eventually) BE.
// Keep this file as the contract — every API endpoint maps to a type here.

// ── Primitives ───────────────────────────────────────────────────────────────

export type UUID = string
export type ISODateTime = string // e.g. "2026-06-11T18:00:00Z"
export type ISODate = string // YYYY-MM-DD
export type CountryCode = string // ISO 3166-1 alpha-2

export const MIN_SCORE = 0
export const MAX_SCORE = 20

export type Booster = 'x2' | 'x3' | 'x5'
export const BOOSTER_TYPES: readonly Booster[] = ['x2', 'x3', 'x5'] as const

export type BoosterMultiplier = 1 | 2 | 3 | 5
export function boosterMultiplier(b: Booster | null): BoosterMultiplier {
  if (b === 'x2') return 2
  if (b === 'x3') return 3
  if (b === 'x5') return 5
  return 1
}

export type BoosterCounts = { x2: number; x3: number; x5: number }
export const EMPTY_BOOSTER_COUNTS: BoosterCounts = { x2: 0, x3: 0, x5: 0 }
export const MAX_BOOSTER_POOL_PER_TYPE = 5

export type MatchStatus = 'scheduled' | 'live' | 'finished'

// ── Profile & Auth ───────────────────────────────────────────────────────────

export type Profile = {
  id: UUID
  displayName: string
  avatarUrl: string | null
}

// ── Football entities ────────────────────────────────────────────────────────

export type Team = {
  id: UUID
  name: string
  shortName: string
  logoUrl: string | null
  countryCode: CountryCode
}

export type Competition = {
  id: UUID
  name: string
  code: string
  type: 'CUP' | 'LEAGUE'
  emblemUrl: string | null
  seasonStart: ISODate
  seasonEnd: ISODate
}

export type Round = {
  id: UUID
  competitionId: UUID
  name: string
  sortOrder: number
}

export type Match = {
  id: UUID
  competitionId: UUID
  round: { id: UUID; name: string; sortOrder: number }
  homeTeam: Team | null // null for TBD knockout fixtures
  awayTeam: Team | null
  kickoffTime: ISODateTime
  status: MatchStatus
  homeScore: number | null
  awayScore: number | null
  matchday: number | null
  liveMinute: string | null // "67'", "45+2'", "HT" — only when status=live
}

// ── League ───────────────────────────────────────────────────────────────────

export type BoosterPoolConfig = {
  enabled: boolean
  pool: BoosterCounts
}

export type LeagueSettings = {
  boosters: BoosterPoolConfig
}

// Lite competition projection embedded in League — keeps the league
// payload small but carries everything the UI needs to render the
// competition emblem/name and detect a finished season.
export type LeagueCompetitionLink = {
  competition: Pick<
    Competition,
    'id' | 'name' | 'code' | 'emblemUrl' | 'seasonEnd'
  >
  // Cutoff for auto-included matches. Matches kicking off before this
  // timestamp are excluded from the league. Defaults to league creation
  // time for legacy leagues, "now" for new ones.
  startDate: ISODateTime
}

export type League = {
  id: UUID
  name: string
  description: string | null
  inviteCode: string
  icon: string | null // emoji or short label; nullable, falls back to trophy
  // A league can follow N competitions. Each link carries its own
  // start_date so mid-season joiners don't compete against history.
  competitions: LeagueCompetitionLink[]
  createdBy: UUID
  settings: LeagueSettings
  memberCount: number
  createdAt: ISODateTime
}

export type LeagueMember = {
  userId: UUID
  leagueId: UUID
  role: 'admin' | 'member'
  joinedAt: ISODateTime
  profile: Profile
}

// ── Predictions & Points ─────────────────────────────────────────────────────

// A single prediction record. Mirrors `predictions` table.
export type Prediction = {
  id: UUID
  userId: UUID
  matchId: UUID
  leagueId: UUID
  homeScore: number
  awayScore: number
  booster: Booster | null
  createdAt: ISODateTime
  updatedAt: ISODateTime
}

// Final or in-progress points decomposition for a single prediction.
// Mirrors the `points` table; `final` is true once the match is finished.
export type PointsBreakdown = {
  base: 0 | 1 | 4
  outcomeBonus: 0 | 1 | 3
  exactBonus: 0 | 1 | 3
  multiplier: BoosterMultiplier
  total: number
  final: boolean
}

// Prediction enriched with predictor profile + computed points.
// `points` is non-null whenever the match is live or finished.
// Visibility: this shape MUST NOT be returned for other users while the
// match is still in `scheduled` status (blind-prediction rule).
export type PredictionWithDetails = Prediction & {
  profile: Profile
  points: PointsBreakdown | null
}

// ── Standings ────────────────────────────────────────────────────────────────

export type StandingRow = {
  position: number
  profile: Profile
  totalPoints: number // points from finished matches
  matchdayPoints: number // points from currently-live matches (provisional)
  exactScores: number // tiebreaker
  boostersUsed: number // total boosters applied so far in this competition
  boostersRemaining: BoosterCounts
  positionChange: number // delta vs. before today's live matches; +up, -down
}

// ── Dashboard summaries ──────────────────────────────────────────────────────

export type LiveMatchSummary = {
  match: Match // status === 'live'
  userPrediction: PredictionWithDetails | null
  predictionCount: number
}

export type UpcomingMatchSummary = {
  match: Match // status === 'scheduled'
  userPrediction: Prediction | null // user's own pick is visible pre-kickoff
}

export type CompletedMatchSummary = {
  match: Match // status === 'finished'
  userPrediction: PredictionWithDetails | null
}

// One league's row on the dashboard.
export type LeagueDashboardSummary = {
  league: League
  userPosition: number
  userTotalPoints: number // total + matchday combined for display
  userMatchdayPoints: number
  userBoostersRemaining: BoosterCounts
  liveMatches: LiveMatchSummary[]
  upcomingMatches: UpcomingMatchSummary[]
  unpredictedCount: number
}

// ── My Leagues screen ────────────────────────────────────────────────────────

export type MyLeagueCard = {
  league: League
  userPosition: number
  userPoints: number
  nextMatchKickoff: ISODateTime | null
  isCompleted: boolean // competition.seasonEnd < now
  finalBadge: '1st' | '2nd' | '3rd' | null // only if completed and top-3
}

export type MyLeaguesPayload = {
  active: MyLeagueCard[]
  completed: MyLeagueCard[]
  stats: {
    totalLeagues: number
    activeLeagues: number
    topThreeFinishes: number
  }
}

// ── League detail ────────────────────────────────────────────────────────────

export type LeagueDetailPayload = {
  league: League
  // True when the current viewer is an admin of this league. Drives the
  // visibility of admin-only affordances (e.g. "Add competition").
  // RLS still enforces auth on the actual mutation; this just hides
  // buttons that would otherwise error.
  isAdmin: boolean
  standings: StandingRow[]
  liveMatches: LiveMatchSummary[]
  upcomingMatches: UpcomingMatchSummary[]
  completedMatches: CompletedMatchSummary[]
  // For live matches, the full predictions table is returned by useMatch().
  // League detail only renders headline info; the inline expand uses useMatch.
}

// ── Match deep view (live or finished) ───────────────────────────────────────

// "Best for You" suggestion — top 3 hypothetical scores ranked by points-if-it-ended-now.
export type BestScoreSuggestion = {
  homeScore: number
  awayScore: number
  isCurrentScore: boolean
  hypotheticalPoints: PointsBreakdown
  reasoning: string // human-readable
}

export type MatchDetailPayload = {
  match: Match
  league: Pick<League, 'id' | 'name'>
  predictions: PredictionWithDetails[] // empty array pre-kickoff
  userPrediction: PredictionWithDetails | null
  bestScoresForUser: BestScoreSuggestion[] // empty if user has no prediction
  standings: StandingRow[] // live standings reflecting current scores
}

// ── Prediction modal context ─────────────────────────────────────────────────

export type LeaguePredictionContext = {
  leagueId: UUID
  leagueName: string
  leagueIcon: string | null
  currentPosition: number
  currentPoints: number
  leaderGap: number
  currentPrediction: Prediction | null
  boostersEnabled: boolean
  boostersRemaining: BoosterCounts
}

export type PredictionContextPayload = {
  match: Match
  // One entry per league the user is in that has this competition.
  leagues: LeaguePredictionContext[]
}

// ── Mutation inputs ──────────────────────────────────────────────────────────

export type SubmitPredictionInput = {
  matchId: UUID
  leagueId: UUID
  homeScore: number
  awayScore: number
  booster: Booster | null
}

// Quick-predict: same score applied to every league the user is in for this match.
// Boosters cannot be applied via quick predict — only via per-league flow.
export type QuickPredictInput = {
  matchId: UUID
  homeScore: number
  awayScore: number
}

export type CreateLeagueInput = {
  name: string
  description: string | null
  // One or more real-world competitions to track. New matches synced
  // into any of these auto-flow into the league.
  competitionIds: UUID[]
  icon: string | null
  settings: LeagueSettings
}

export type AddLeagueCompetitionInput = {
  leagueId: UUID
  competitionId: UUID
}

// Partial update for league metadata. Only fields you pass are written
// — undefined means "leave it alone", null on `icon` means "clear it".
// Restricted to admins by RLS (leagues_update_admin).
export type UpdateLeagueInput = {
  leagueId: UUID
  name?: string
  icon?: string | null
}

export type UpdateProfileInput = {
  // Both fields are optional so callers can update name independently of
  // avatar (the common case after typing in the input). Pass `null` for
  // avatarUrl to clear the existing one.
  displayName?: string
  avatarUrl?: string | null
}

export type CreateLeagueResult = {
  league: League
  inviteUrl: string
}

export type JoinLeagueInput = { inviteCode: string }
