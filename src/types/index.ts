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
  notificationsEnabled: boolean
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
  // Server-persisted points if the linked match has finished. Set by
  // the compute_points_for_match trigger; surfaced via the
  // predictions→points embed in queries. Null while the match is still
  // scheduled or live, OR briefly during the race window between a
  // status flip to 'finished' and the trigger firing.
  storedPoints: PointsBreakdown | null
}

// Final or in-progress points decomposition for a single prediction.
// Mirrors the `points` table; `final` is true once the match is finished.
// Audit fields (memberCount, sameOutcomeCount, sameExactCount,
// outcomePct, exactPct) are populated only when the breakdown was
// loaded from the persisted `points` row — not when computed live in
// the UI.
export type PointsBreakdown = {
  base: 0 | 1 | 4
  outcomeBonus: 0 | 1 | 3
  exactBonus: 0 | 1 | 3
  multiplier: BoosterMultiplier
  total: number
  final: boolean
  // Audit fields — present only on persisted points rows.
  memberCount?: number
  sameOutcomeCount?: number
  sameExactCount?: number
  outcomePct?: number
  exactPct?: number
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
  // True when this row represents the currently-authenticated user.
  // Set server-side so every UI consumer can highlight the user's row
  // with a single boolean check instead of comparing display names
  // (which collide for users named "You" or sharing a name).
  isCurrentUser: boolean
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
  // All picks for this match, ranked by points earned so far (desc).
  // Lets the league board render an inline "who's scoring now" preview
  // (top N + the user's pinned row) without a separate per-match fetch.
  // Safe to expose: predictions are visible once a match is live.
  rankedPredictions: PredictionWithDetails[]
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
  // Compact standings for the dashboard card: top 3 by combined points,
  // plus the current user's row if they're outside the top 3. Empty for
  // single-member leagues. Used to render a mini-table when the league
  // has no live matches at the moment.
  standingsPreview: StandingRow[]
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
  // Roster — used by the settings screen for the kick flow. Includes
  // the caller's own row so the UI can mark "you" and prevent self-kick.
  members: LeagueMember[]
  standings: StandingRow[]
  liveMatches: LiveMatchSummary[]
  upcomingMatches: UpcomingMatchSummary[]
  completedMatches: CompletedMatchSummary[]
  // For live matches, the full predictions table is returned by useMatch().
  // League detail only renders headline info; the inline expand uses useMatch.
}

export type RemoveLeagueMemberInput = {
  leagueId: UUID
  userId: UUID
}

// ── Match deep view (live or finished) ───────────────────────────────────────

export type MatchDetailPayload = {
  match: Match
  league: Pick<League, 'id' | 'name' | 'icon'>
  predictions: PredictionWithDetails[] // empty array pre-kickoff
  userPrediction: PredictionWithDetails | null
  standings: StandingRow[] // live standings reflecting current scores
  // League member count — rarity denominator + the "X of N predicted"
  // overview line. Already known server-side; surfaced so the match screen
  // can derive Moments client-side without a second fetch.
  memberCount: number
}

// ── Moments (match stories) ──────────────────────────────────────────────────

// A derived highlight from a finished match within a league. A match can
// produce several; the highest-`severity` one is its headline.
export type MomentKind =
  | 'exact' // someone nailed the exact score
  | 'haul' // a big single-match points total
  | 'contrarian' // a correct call almost nobody else made
  | 'booster' // a booster gamble that paid off
  | 'collective' // whole-league beat (everyone missed / clean sweep)
  | 'mover' // standings jump driven by this match (reserved — see derive.ts)

export type MomentRarity = {
  sameOutcomeCount: number
  memberCount: number
  outcomePct: number
}

export type Moment = {
  kind: MomentKind
  matchId: UUID
  league: { id: UUID; name: string; icon: string | null }
  match: Match // finished, with teams + final score
  actor?: Profile // single player the moment is about
  actors?: Profile[] // multiple players (e.g. several exact hits)
  points?: number
  booster?: Booster
  rarity?: MomentRarity
  headline: string
  subtext?: string
  severity: number // ranks moments within a match (headline) + feed tiebreak
}

// Always-present league roll-up for a finished match — the "what happened
// for all players" floor every match gets, even with no standout Moment.
export type MatchOverview = {
  memberCount: number
  predictionCount: number
  homeCount: number // predicted a home win
  drawCount: number
  awayCount: number
  correctCount: number // got the outcome right (base >= 1)
  exactCount: number // nailed the exact score (base === 4)
  topPoints: number
  topScorer: Profile | null
  // The league's majority pick + the team it names (drives "15 backed
  // Brazil"). `team` is null for a draw consensus; whole field null when
  // nobody predicted.
  consensus: {
    side: 'home' | 'draw' | 'away'
    team: Team | null
    count: number
  } | null
}

// The viewing user's own result for a match — powers the "you scored" strip on
// the league Played feed (deliberately not shown on the cross-league dashboard,
// where the viewer's row isn't the point). `none` = member didn't predict.
export type MomentViewer = {
  status: 'exact' | 'outcome' | 'wrong' | 'none'
  homeScore: number | null
  awayScore: number | null
  points: number
}

// One feed row: a match's always-on overview + its standout moments.
// `headline` is null when the match produced no standout — the card then
// leads with the overview itself.
export type MomentFeedItem = {
  matchId: UUID
  league: { id: UUID; name: string; icon: string | null }
  match: Match
  overview: MatchOverview
  headline: Moment | null
  moments: Moment[] // severity-desc; may be empty
  kickoffTime: ISODateTime
  viewer?: MomentViewer // populated when a viewerId is supplied to toFeedItem
}

export type RecentMomentsPage = {
  items: MomentFeedItem[]
  // Opaque composite cursor (kickoff#match#league) of the last item; null when
  // the whole history has been paged through. Composite so simultaneous
  // kickoffs (tournaments) are never skipped at a page boundary.
  nextCursor: string | null
}

// ── Live-match board + scenarios ──────────────────────────────────────────────
//
// Derived purely from the visible picks of a live match (peers' predictions
// unlock at kickoff). The board groups "who picked what"; scenarios run those
// same picks through the real scorer against a few plausible final scores.

// One distinct scoreline within an outcome group + who backed it.
export type ScoreSlice = {
  homeScore: number
  awayScore: number
  players: Profile[]
  // Modal booster among the backers (for the pill); null when nobody boosted.
  booster: Booster | null
}

// All picks for one outcome side, broken down by exact scoreline.
export type PredictionGroup = {
  side: 'home' | 'draw' | 'away'
  team: Team | null // null for a draw
  count: number
  scorelines: ScoreSlice[] // backer count desc
}

// A "what-if" final score, with the league story it would produce. `overview`'s
// correct/exact/top fields are recomputed against this hypothetical result.
export type MatchScenario = {
  finalScore: { home: number; away: number }
  side: 'home' | 'draw' | 'away'
  isCurrent: boolean // matches the current live score ("if it stays …")
  // Set for next-goal scenarios: which team's goal produces this scoreline
  // (drives the "If <team> scores" framing). Undefined for plain what-ifs.
  scorer?: 'home' | 'away'
  // Set for next-goal scenarios: who'd nail this exact scoreline — the players
  // "in for the big points" — with their projected total, biggest-first.
  winners?: NextGoalWinner[]
  overview: MatchOverview
  headline: Moment | null // the lead story under this outcome
}

// One player who'd cash in big under a next-goal scoreline.
export type NextGoalWinner = {
  profile: Profile
  points: number // projected total if this scoreline happens
  booster: Booster | null
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
  notificationsEnabled?: boolean
}

export type CreateLeagueResult = {
  league: League
  inviteUrl: string
}

export type JoinLeagueInput = { inviteCode: string }
