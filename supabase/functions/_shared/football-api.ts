// Thin client for football-data.org v4. Used by Supabase Edge Functions
// (Deno runtime) and the Next.js server side. No browser usage — the API
// key is server-only.
//
// Docs: https://www.football-data.org/documentation/api
// Auth: header `X-Auth-Token: <key>`
// Rate limit on Livescores plan: 20 requests / minute / IP.

const BASE_URL = 'https://api.football-data.org/v4'

// ── External response types (subset we use) ─────────────────────────────────

// football-data.org v4 status values. We collapse them to our 3-value enum
// in `mapStatus`; keep this list literal so a typo gets caught.
export type FootballApiStatus =
  | 'SCHEDULED'
  | 'TIMED'
  | 'IN_PLAY'
  | 'PAUSED'
  | 'FINISHED'
  | 'POSTPONED'
  | 'SUSPENDED'
  | 'CANCELLED'
  | 'AWARDED'

export type FootballApiTeam = {
  id: number
  name: string
  shortName: string | null
  tla: string | null
  crest: string | null
}

export type FootballApiMatch = {
  id: number
  utcDate: string // ISO
  status: FootballApiStatus
  matchday: number | null
  stage: string // "GROUP_STAGE", "LAST_16", "QUARTER_FINALS", ...
  group: string | null // "GROUP_A" etc.
  // football-data.org's "minute" field on live matches.
  // Present only when status is IN_PLAY/PAUSED. May be absent on free tier.
  minute?: number | string | null
  injuryTime?: number | null
  homeTeam: FootballApiTeam | { id: null; name: string | null }
  awayTeam: FootballApiTeam | { id: null; name: string | null }
  score: {
    winner: 'HOME_TEAM' | 'AWAY_TEAM' | 'DRAW' | null
    duration: 'REGULAR' | 'EXTRA_TIME' | 'PENALTY_SHOOTOUT'
    fullTime: { home: number | null; away: number | null }
    halfTime: { home: number | null; away: number | null }
  }
  competition: {
    id: number
    name: string
    code: string
  }
}

type MatchesResponse = {
  matches: FootballApiMatch[]
  resultSet?: { count: number }
}

type TeamsResponse = {
  teams: FootballApiTeam[]
}

// ── Mapped types we hand back to callers ────────────────────────────────────

export type DomainMatchStatus = 'scheduled' | 'live' | 'finished'

export function mapStatus(status: FootballApiStatus): DomainMatchStatus {
  if (status === 'IN_PLAY' || status === 'PAUSED') return 'live'
  if (status === 'FINISHED' || status === 'AWARDED') return 'finished'
  // POSTPONED, SUSPENDED, CANCELLED, SCHEDULED, TIMED → 'scheduled'.
  // We treat the disrupted states as scheduled for now; a future field
  // (matches.disruption_status) can carry the nuance.
  return 'scheduled'
}

// "67'", "45+2'", "HT", or null.
export function formatLiveMinute(m: FootballApiMatch): string | null {
  if (m.status === 'PAUSED') return 'HT'
  if (m.status !== 'IN_PLAY') return null
  if (m.minute == null) return null
  const base = String(m.minute).replace(/[^\d]/g, '')
  if (m.injuryTime && m.injuryTime > 0) {
    return `${base}+${m.injuryTime}'`
  }
  return `${base}'`
}

// ── Client ──────────────────────────────────────────────────────────────────

export class FootballApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'FootballApiError'
  }
}

export type FootballApiClient = {
  getCompetitionMatches: (
    code: string,
    params?: {
      status?: 'SCHEDULED' | 'LIVE' | 'FINISHED'
      matchday?: number
      // ISO YYYY-MM-DD. dateFrom is inclusive; dateTo is exclusive per
      // football-data.org's behaviour. Use both to scope live polling.
      dateFrom?: string
      dateTo?: string
    },
  ) => Promise<FootballApiMatch[]>
  getCompetitionTeams: (code: string) => Promise<FootballApiTeam[]>
}

export function createFootballApiClient(apiKey: string): FootballApiClient {
  if (!apiKey) {
    throw new Error('FOOTBALL_DATA_API_KEY is required')
  }

  async function request<T>(path: string): Promise<T> {
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: { 'X-Auth-Token': apiKey },
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new FootballApiError(
        res.status,
        `football-data.org ${res.status}: ${body || res.statusText}`,
      )
    }
    return res.json() as Promise<T>
  }

  return {
    async getCompetitionMatches(code, params) {
      const qs = new URLSearchParams()
      if (params?.status) qs.set('status', params.status)
      if (params?.matchday != null) qs.set('matchday', String(params.matchday))
      if (params?.dateFrom) qs.set('dateFrom', params.dateFrom)
      if (params?.dateTo) qs.set('dateTo', params.dateTo)
      const suffix = qs.toString() ? `?${qs.toString()}` : ''
      const data = await request<MatchesResponse>(
        `/competitions/${code}/matches${suffix}`,
      )
      return data.matches
    },

    async getCompetitionTeams(code) {
      const data = await request<TeamsResponse>(`/competitions/${code}/teams`)
      return data.teams
    },
  }
}
