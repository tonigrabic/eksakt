// Mock data fixtures shaped exactly like the real API will return.
// Stable identities + deterministic time math so the UI is reproducible.

import type {
  Competition,
  ISODate,
  ISODateTime,
  League,
  LeagueMember,
  Match,
  Prediction,
  Profile,
  Team,
  UUID,
} from '@/types'

// ── Time helpers ─────────────────────────────────────────────────────────────

const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

// Anchor on module-load wall time so countdowns vs. Date.now() stay accurate.
// All hooks are client-only ("use client") so SSR mismatch isn't a concern.
const NOW = Date.now()

function iso(ms: number): ISODateTime {
  return new Date(ms).toISOString()
}

// ── Profiles ─────────────────────────────────────────────────────────────────

export const CURRENT_USER_ID: UUID = 'user-you'

export const profiles: Record<UUID, Profile> = {
  [CURRENT_USER_ID]: { id: CURRENT_USER_ID, displayName: 'You', avatarUrl: null },
  'user-sarah':  { id: 'user-sarah',  displayName: 'Sarah',  avatarUrl: null },
  'user-john':   { id: 'user-john',   displayName: 'John',   avatarUrl: null },
  'user-emma':   { id: 'user-emma',   displayName: 'Emma',   avatarUrl: null },
  'user-david':  { id: 'user-david',  displayName: 'David',  avatarUrl: null },
  'user-lisa':   { id: 'user-lisa',   displayName: 'Lisa',   avatarUrl: null },
  'user-tom':    { id: 'user-tom',    displayName: 'Tom',    avatarUrl: null },
  'user-anna':   { id: 'user-anna',   displayName: 'Anna',   avatarUrl: null },
  'user-chris':  { id: 'user-chris',  displayName: 'Chris',  avatarUrl: null },
  'user-sophie': { id: 'user-sophie', displayName: 'Sophie', avatarUrl: null },
  'user-mark':   { id: 'user-mark',   displayName: 'Mark',   avatarUrl: null },
  'user-julia':  { id: 'user-julia',  displayName: 'Julia',  avatarUrl: null },
  'user-marko':  { id: 'user-marko',  displayName: 'Marko',  avatarUrl: null },
  'user-ivan':   { id: 'user-ivan',   displayName: 'Ivan',   avatarUrl: null },
  'user-luka':   { id: 'user-luka',   displayName: 'Luka',   avatarUrl: null },
  'user-ante':   { id: 'user-ante',   displayName: 'Ante',   avatarUrl: null },
  'user-josip':  { id: 'user-josip',  displayName: 'Josip',  avatarUrl: null },
  'user-petar':  { id: 'user-petar',  displayName: 'Petar',  avatarUrl: null },
  'user-nikola': { id: 'user-nikola', displayName: 'Nikola', avatarUrl: null },
  'user-alex':   { id: 'user-alex',   displayName: 'Alex',   avatarUrl: null },
  'user-ben':    { id: 'user-ben',    displayName: 'Ben',    avatarUrl: null },
  'user-chloe':  { id: 'user-chloe',  displayName: 'Chloe',  avatarUrl: null },
  'user-mike':   { id: 'user-mike',   displayName: 'Mike',   avatarUrl: null },
  'user-rachel': { id: 'user-rachel', displayName: 'Rachel', avatarUrl: null },
  'user-sam':    { id: 'user-sam',    displayName: 'Sam',    avatarUrl: null },
  'user-ollie':  { id: 'user-ollie',  displayName: 'Ollie',  avatarUrl: null },
  'user-jess':   { id: 'user-jess',   displayName: 'Jess',   avatarUrl: null },
  'user-dan':    { id: 'user-dan',    displayName: 'Dan',    avatarUrl: null },
  'user-amy':    { id: 'user-amy',    displayName: 'Amy',    avatarUrl: null },
  'user-finn':   { id: 'user-finn',   displayName: 'Finn',   avatarUrl: null },
  'user-grace':  { id: 'user-grace',  displayName: 'Grace',  avatarUrl: null },
  'user-leo':    { id: 'user-leo',    displayName: 'Leo',    avatarUrl: null },
  'user-nina':   { id: 'user-nina',   displayName: 'Nina',   avatarUrl: null },
  'user-hugo':   { id: 'user-hugo',   displayName: 'Hugo',   avatarUrl: null },
  'user-tara':   { id: 'user-tara',   displayName: 'Tara',   avatarUrl: null },
  'user-will':   { id: 'user-will',   displayName: 'Will',   avatarUrl: null },
  'user-zoe':    { id: 'user-zoe',    displayName: 'Zoe',    avatarUrl: null },
}

// ── Teams ────────────────────────────────────────────────────────────────────

const team = (
  id: string,
  name: string,
  shortName: string,
  countryCode: string,
): Team => ({ id, name, shortName, countryCode, logoUrl: null })

export const teams = {
  croatia:   team('team-cro', 'Croatia',   'CRO', 'HR'),
  france:    team('team-fra', 'France',    'FRA', 'FR'),
  brazil:    team('team-bra', 'Brazil',    'BRA', 'BR'),
  germany:   team('team-ger', 'Germany',   'GER', 'DE'),
  argentina: team('team-arg', 'Argentina', 'ARG', 'AR'),
  spain:     team('team-esp', 'Spain',     'ESP', 'ES'),
  portugal:  team('team-por', 'Portugal',  'POR', 'PT'),
  england:   team('team-eng', 'England',   'ENG', 'GB'),
} as const satisfies Record<string, Team>

// ── Competitions ─────────────────────────────────────────────────────────────

const date = (ms: number): ISODate => new Date(ms).toISOString().slice(0, 10)

export const competitions: Record<UUID, Competition> = {
  'comp-wc': {
    id: 'comp-wc',
    name: 'FIFA World Cup 2026',
    code: 'WC',
    type: 'CUP',
    emblemUrl: null,
    seasonStart: date(NOW - 5 * DAY),
    seasonEnd: date(NOW + 30 * DAY),
  },
  'comp-pl': {
    id: 'comp-pl',
    name: 'Premier League 2025/26',
    code: 'PL',
    type: 'LEAGUE',
    emblemUrl: null,
    seasonStart: date(NOW - 280 * DAY),
    seasonEnd: date(NOW - 60 * DAY), // already concluded → completed league
  },
  'comp-cl': {
    id: 'comp-cl',
    name: 'Champions League 2025/26',
    code: 'CL',
    type: 'CUP',
    emblemUrl: null,
    seasonStart: date(NOW - 240 * DAY),
    seasonEnd: date(NOW + 14 * DAY),
  },
  'comp-euro': {
    id: 'comp-euro',
    name: 'Euro 2028',
    code: 'EURO',
    type: 'CUP',
    emblemUrl: null,
    seasonStart: date(NOW + 700 * DAY),
    seasonEnd: date(NOW + 730 * DAY),
  },
}

// ── Rounds ───────────────────────────────────────────────────────────────────

const round = (id: string, competitionId: UUID, name: string, sortOrder: number) => ({
  id,
  competitionId,
  name,
  sortOrder,
})

export const rounds = {
  wcGroup:    round('round-wc-group',  'comp-wc', 'Group Stage',    1),
  wcR16:      round('round-wc-r16',    'comp-wc', 'Round of 16',    2),
  wcQF:       round('round-wc-qf',     'comp-wc', 'Quarter Finals', 3),
  plGw28:     round('round-pl-gw28',   'comp-pl', 'Gameweek 28',    28),
  plGw29:     round('round-pl-gw29',   'comp-pl', 'Gameweek 29',    29),
}

// ── Matches ──────────────────────────────────────────────────────────────────

export const matches: Record<UUID, Match> = {
  // ── LIVE: Croatia 1-1 France (67') ──
  'match-cro-fra': {
    id: 'match-cro-fra',
    competitionId: 'comp-wc',
    round: rounds.wcR16,
    homeTeam: teams.croatia,
    awayTeam: teams.france,
    kickoffTime: iso(NOW - 67 * MIN),
    status: 'live',
    homeScore: 1,
    awayScore: 1,
    matchday: null,
    liveMinute: "67'",
  },
  // ── LIVE: Brazil 2-0 Germany (45+2') ──
  'match-bra-ger': {
    id: 'match-bra-ger',
    competitionId: 'comp-wc',
    round: rounds.wcR16,
    homeTeam: teams.brazil,
    awayTeam: teams.germany,
    kickoffTime: iso(NOW - 47 * MIN),
    status: 'live',
    homeScore: 2,
    awayScore: 0,
    matchday: null,
    liveMinute: "45+2'",
  },
  // ── UPCOMING ──
  'match-arg-esp': {
    id: 'match-arg-esp',
    competitionId: 'comp-wc',
    round: rounds.wcR16,
    homeTeam: teams.argentina,
    awayTeam: teams.spain,
    kickoffTime: iso(NOW + 2 * HOUR + 15 * MIN),
    status: 'scheduled',
    homeScore: null,
    awayScore: null,
    matchday: null,
    liveMinute: null,
  },
  'match-por-eng': {
    id: 'match-por-eng',
    competitionId: 'comp-wc',
    round: rounds.wcR16,
    homeTeam: teams.portugal,
    awayTeam: teams.england,
    kickoffTime: iso(NOW + 5 * HOUR + 45 * MIN),
    status: 'scheduled',
    homeScore: null,
    awayScore: null,
    matchday: null,
    liveMinute: null,
  },
  'match-fra-bra': {
    id: 'match-fra-bra',
    competitionId: 'comp-wc',
    round: rounds.wcQF,
    homeTeam: teams.france,
    awayTeam: teams.brazil,
    kickoffTime: iso(NOW + 27 * HOUR),
    status: 'scheduled',
    homeScore: null,
    awayScore: null,
    matchday: null,
    liveMinute: null,
  },
  // ── COMPLETED (Premier league) ──
  'match-arg-bra-pl': {
    id: 'match-arg-bra-pl',
    competitionId: 'comp-pl',
    round: rounds.plGw28,
    homeTeam: teams.argentina,
    awayTeam: teams.brazil,
    kickoffTime: iso(NOW - 65 * DAY),
    status: 'finished',
    homeScore: 3,
    awayScore: 2,
    matchday: 28,
    liveMinute: null,
  },
  'match-esp-ger-pl': {
    id: 'match-esp-ger-pl',
    competitionId: 'comp-pl',
    round: rounds.plGw28,
    homeTeam: teams.spain,
    awayTeam: teams.germany,
    kickoffTime: iso(NOW - 65 * DAY),
    status: 'finished',
    homeScore: 1,
    awayScore: 1,
    matchday: 28,
    liveMinute: null,
  },
  'match-eng-por-pl': {
    id: 'match-eng-por-pl',
    competitionId: 'comp-pl',
    round: rounds.plGw28,
    homeTeam: teams.england,
    awayTeam: teams.portugal,
    kickoffTime: iso(NOW - 65 * DAY),
    status: 'finished',
    homeScore: 0,
    awayScore: 1,
    matchday: 28,
    liveMinute: null,
  },
}

// ── Leagues ──────────────────────────────────────────────────────────────────

const defaultBoosters = {
  enabled: true,
  pool: { x2: 3, x3: 1, x5: 1 },
}

const league = (
  id: UUID,
  name: string,
  competitionId: UUID,
  icon: string | null,
  members: number,
  inviteCode: string,
): League => ({
  id,
  name,
  description: null,
  inviteCode,
  icon,
  competitions: [
    {
      competition: {
        id: competitions[competitionId].id,
        name: competitions[competitionId].name,
        code: competitions[competitionId].code,
        emblemUrl: competitions[competitionId].emblemUrl,
        seasonEnd: competitions[competitionId].seasonEnd,
      },
      // Mock leagues "started" 30 days ago so all fixture matches count.
      startDate: iso(NOW - 30 * DAY),
    },
  ],
  createdBy: CURRENT_USER_ID,
  settings: { boosters: defaultBoosters },
  memberCount: members,
  createdAt: iso(NOW - 30 * DAY),
})

export const leagues: Record<UUID, League> = {
  'lg-office':  league('lg-office',  'Office League',          'comp-wc', '🏢', 12, 'OFFICE'),
  'lg-balkan':  league('lg-balkan',  'Balkan Boys',            'comp-wc', '⚽',  8, 'BALKAN'),
  'lg-wc2026':  league('lg-wc2026',  'World Cup 2026',         'comp-wc', '🏆',  4, 'WC2026'),
  'lg-premier': league('lg-premier', 'Premier League Preds',   'comp-pl', '🦁', 16, 'PREMIE'),
  'lg-family':  league('lg-family',  'Family League',          'comp-pl', '👨‍👩‍👧‍👦',  1, 'FAMILY'),
  'lg-euro':    league('lg-euro',    'Euro 2024 Champions',    'comp-pl', '🇪🇺',  1, 'EURO24'),
}

// Per-league member roster. The lengths must equal League.memberCount.
const officeRoster = [
  CURRENT_USER_ID, 'user-sarah', 'user-john', 'user-emma', 'user-david',
  'user-lisa', 'user-tom', 'user-anna', 'user-chris', 'user-sophie',
  'user-mark', 'user-julia',
]
const balkanRoster = [
  CURRENT_USER_ID, 'user-marko', 'user-ivan', 'user-luka', 'user-ante',
  'user-josip', 'user-petar', 'user-nikola',
]
const wc2026Roster = [
  CURRENT_USER_ID, 'user-alex', 'user-ben', 'user-chloe',
]
const premierRoster = [
  CURRENT_USER_ID, 'user-mike', 'user-rachel', 'user-sam', 'user-ollie',
  'user-jess', 'user-dan', 'user-amy', 'user-finn', 'user-grace',
  'user-leo', 'user-nina', 'user-hugo', 'user-tara', 'user-will', 'user-zoe',
]

export const leagueMembers: Record<UUID, LeagueMember[]> = {
  'lg-office':  officeRoster.map((u) => mkMember('lg-office', u)),
  'lg-balkan':  balkanRoster.map((u) => mkMember('lg-balkan', u)),
  'lg-wc2026':  wc2026Roster.map((u) => mkMember('lg-wc2026', u)),
  'lg-premier': premierRoster.map((u) => mkMember('lg-premier', u)),
  'lg-family':  [CURRENT_USER_ID].map((u) => mkMember('lg-family', u)),
  'lg-euro':    [CURRENT_USER_ID].map((u) => mkMember('lg-euro', u)),
}

function mkMember(leagueId: UUID, userId: UUID): LeagueMember {
  // Profile may not exist for "silent" padding users — synthesize on the fly.
  const profile =
    profiles[userId] ??
    ({ id: userId, displayName: userId.replace(/^user-/, ''), avatarUrl: null } as Profile)
  return {
    leagueId,
    userId,
    role: userId === CURRENT_USER_ID ? 'admin' : 'member',
    joinedAt: iso(NOW - 25 * DAY),
    profile,
  }
}

// ── Predictions ──────────────────────────────────────────────────────────────

let _pid = 0
const pid = () => `pred-${++_pid}`

function p(
  userId: UUID,
  matchId: UUID,
  leagueId: UUID,
  homeScore: number,
  awayScore: number,
  booster: 'x2' | 'x3' | 'x5' | null = null,
): Prediction {
  const ts = iso(NOW - 1 * DAY)
  return {
    id: pid(),
    userId,
    matchId,
    leagueId,
    homeScore,
    awayScore,
    booster,
    createdAt: ts,
    updatedAt: ts,
    // Mock fixtures don't materialize stored points; the mock derive
    // recomputes from raw data each time, so this is always null.
    storedPoints: null,
  }
}

export const predictions: Prediction[] = [
  // ── lg-office: Croatia vs France ──
  p(CURRENT_USER_ID,  'match-cro-fra', 'lg-office', 1, 1, 'x2'),
  p('user-sarah',     'match-cro-fra', 'lg-office', 2, 1),
  p('user-john',      'match-cro-fra', 'lg-office', 1, 0, 'x3'),
  p('user-emma',      'match-cro-fra', 'lg-office', 1, 1),
  p('user-david',     'match-cro-fra', 'lg-office', 0, 0, 'x5'),
  p('user-lisa',      'match-cro-fra', 'lg-office', 2, 1),
  p('user-tom',       'match-cro-fra', 'lg-office', 3, 1),
  p('user-anna',      'match-cro-fra', 'lg-office', 1, 2),
  p('user-chris',     'match-cro-fra', 'lg-office', 0, 0),
  p('user-sophie',    'match-cro-fra', 'lg-office', 2, 2),
  p('user-mark',      'match-cro-fra', 'lg-office', 1, 1),
  p('user-julia',     'match-cro-fra', 'lg-office', 2, 0),

  // ── lg-office: Brazil vs Germany ──
  p(CURRENT_USER_ID,  'match-bra-ger', 'lg-office', 2, 1),
  p('user-sarah',     'match-bra-ger', 'lg-office', 2, 0),
  p('user-john',      'match-bra-ger', 'lg-office', 1, 0),
  p('user-emma',      'match-bra-ger', 'lg-office', 3, 1),
  p('user-david',     'match-bra-ger', 'lg-office', 0, 2),
  p('user-lisa',      'match-bra-ger', 'lg-office', 2, 0, 'x2'),
  p('user-tom',       'match-bra-ger', 'lg-office', 1, 1),
  p('user-anna',      'match-bra-ger', 'lg-office', 2, 0),
  p('user-chris',     'match-bra-ger', 'lg-office', 0, 1),
  p('user-sophie',    'match-bra-ger', 'lg-office', 3, 0),
  p('user-mark',      'match-bra-ger', 'lg-office', 2, 1),
  p('user-julia',     'match-bra-ger', 'lg-office', 2, 0),

  // ── lg-office: upcoming (only user has one — predicted) ──
  p(CURRENT_USER_ID,  'match-arg-esp', 'lg-office', 2, 1),
  p('user-sarah',     'match-arg-esp', 'lg-office', 1, 1),
  p('user-john',      'match-arg-esp', 'lg-office', 2, 0),
  // (others skipped — that's fine, blind predictions stay hidden anyway)

  // ── lg-balkan: Croatia vs France ──
  p(CURRENT_USER_ID,  'match-cro-fra', 'lg-balkan', 2, 0),
  p('user-marko',     'match-cro-fra', 'lg-balkan', 1, 1, 'x5'),
  p('user-ivan',      'match-cro-fra', 'lg-balkan', 1, 0),
  p('user-luka',      'match-cro-fra', 'lg-balkan', 0, 0),
  p('user-ante',      'match-cro-fra', 'lg-balkan', 3, 1),
  p('user-josip',     'match-cro-fra', 'lg-balkan', 2, 1, 'x2'),
  p('user-petar',     'match-cro-fra', 'lg-balkan', 1, 1),
  p('user-nikola',    'match-cro-fra', 'lg-balkan', 1, 2),

  // ── lg-balkan: upcoming ──
  p(CURRENT_USER_ID,  'match-arg-esp', 'lg-balkan', 3, 2),

  // ── lg-wc2026: Croatia vs France ──
  p(CURRENT_USER_ID,  'match-cro-fra', 'lg-wc2026', 0, 1),
  p('user-alex',      'match-cro-fra', 'lg-wc2026', 1, 1),
  p('user-ben',       'match-cro-fra', 'lg-wc2026', 2, 1),
  p('user-chloe',     'match-cro-fra', 'lg-wc2026', 0, 0, 'x3'),

  // ── lg-wc2026: Brazil vs Germany ──
  p(CURRENT_USER_ID,  'match-bra-ger', 'lg-wc2026', 1, 0),
  p('user-alex',      'match-bra-ger', 'lg-wc2026', 3, 0),
  p('user-ben',       'match-bra-ger', 'lg-wc2026', 2, 0, 'x2'),
  p('user-chloe',     'match-bra-ger', 'lg-wc2026', 1, 1),

  // ── lg-wc2026: upcoming ──
  p(CURRENT_USER_ID,  'match-por-eng', 'lg-wc2026', 0, 0),

  // ── lg-premier: Gameweek 28 (completed) ──
  p(CURRENT_USER_ID,  'match-arg-bra-pl', 'lg-premier', 2, 1),
  p('user-mike',      'match-arg-bra-pl', 'lg-premier', 3, 2),
  p('user-rachel',    'match-arg-bra-pl', 'lg-premier', 2, 2),
  p('user-sam',       'match-arg-bra-pl', 'lg-premier', 3, 1),
  p('user-ollie',     'match-arg-bra-pl', 'lg-premier', 1, 1),

  p(CURRENT_USER_ID,  'match-esp-ger-pl', 'lg-premier', 1, 1),
  p('user-mike',      'match-esp-ger-pl', 'lg-premier', 1, 1),
  p('user-rachel',    'match-esp-ger-pl', 'lg-premier', 2, 0),
  p('user-sam',       'match-esp-ger-pl', 'lg-premier', 0, 1),

  p(CURRENT_USER_ID,  'match-eng-por-pl', 'lg-premier', 2, 0),
  p('user-mike',      'match-eng-por-pl', 'lg-premier', 0, 1, 'x2'),
  p('user-rachel',    'match-eng-por-pl', 'lg-premier', 1, 1),
  p('user-sam',       'match-eng-por-pl', 'lg-premier', 0, 0),
]

// ── Pre-match standings snapshot (used to compute positionChange) ────────────
//
// The "positionChange" column on the live screen compares current standings
// (post-live-match) to the snapshot taken before today's matches kicked off.
// Real BE will store this; mock seeds it directly.

export const standingsBefore: Record<UUID, Record<UUID, number>> = {
  'lg-office': {
    [CURRENT_USER_ID]: 4, 'user-sarah': 1, 'user-emma': 2, 'user-john': 3,
    'user-lisa': 5, 'user-anna': 7, 'user-mark': 6, 'user-julia': 9,
    'user-sophie': 8, 'user-tom': 10, 'user-david': 11, 'user-chris': 12,
  },
  'lg-balkan': {
    [CURRENT_USER_ID]: 1, 'user-ivan': 2, 'user-marko': 5, 'user-petar': 4,
    'user-luka': 3, 'user-ante': 6, 'user-nikola': 7, 'user-josip': 8,
  },
  'lg-wc2026': {
    [CURRENT_USER_ID]: 1, 'user-alex': 3, 'user-ben': 4, 'user-chloe': 2,
  },
  'lg-premier': {},
  'lg-family': {},
  'lg-euro': {},
}
