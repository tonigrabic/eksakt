// Mock API surface. Each function here corresponds 1:1 to a future real
// endpoint. Hooks call these via TanStack Query, so swapping mock → real
// fetch later is a search-and-replace inside this file.

import type {
  Competition,
  CreateLeagueInput,
  CreateLeagueResult,
  JoinLeagueInput,
  League,
  LeagueDetailPayload,
  LeagueDashboardSummary,
  MatchDetailPayload,
  MyLeaguesPayload,
  PredictionContextPayload,
  Profile,
  QuickPredictInput,
  SubmitPredictionInput,
  UUID,
} from '@/types'
import {
  buildDashboard,
  buildLeagueDetail,
  buildMatchDetail,
  buildMyLeagues,
  buildPredictionContext,
} from './derive'
import {
  CURRENT_USER_ID,
  competitions,
  leagues as leaguesTable,
  predictions as predictionsTable,
  profiles,
} from './fixtures'

// Simulate network latency to flush out missing loading states. Set to 0
// to render synchronously while iterating on visuals.
const LATENCY_MS = 0

function delay<T>(value: T): Promise<T> {
  if (LATENCY_MS === 0) return Promise.resolve(value)
  return new Promise((resolve) => setTimeout(() => resolve(value), LATENCY_MS))
}

// ── Reads ────────────────────────────────────────────────────────────────────

export function getCurrentUser(): Promise<Profile> {
  return delay(profiles[CURRENT_USER_ID])
}

export function getDashboard(): Promise<LeagueDashboardSummary[]> {
  return delay(buildDashboard())
}

export function getMyLeagues(): Promise<MyLeaguesPayload> {
  return delay(buildMyLeagues())
}

export function getLeagueDetail(leagueId: UUID): Promise<LeagueDetailPayload> {
  const data = buildLeagueDetail(leagueId)
  if (!data) return Promise.reject(new Error(`League not found: ${leagueId}`))
  return delay(data)
}

export function getMatchDetail(
  matchId: UUID,
  leagueId: UUID,
): Promise<MatchDetailPayload> {
  const data = buildMatchDetail(matchId, leagueId)
  if (!data) {
    return Promise.reject(new Error(`Match not found: ${matchId}/${leagueId}`))
  }
  return delay(data)
}

export function getPredictionContext(
  matchId: UUID,
): Promise<PredictionContextPayload> {
  const data = buildPredictionContext(matchId)
  if (!data) return Promise.reject(new Error(`Match not found: ${matchId}`))
  return delay(data)
}

export function listCompetitions(): Promise<Competition[]> {
  return delay(
    Object.values(competitions).filter(
      (c) => new Date(c.seasonEnd).getTime() >= Date.now(),
    ),
  )
}

// ── Mutations ────────────────────────────────────────────────────────────────

export async function submitPrediction(
  input: SubmitPredictionInput,
): Promise<void> {
  const existing = predictionsTable.find(
    (p) =>
      p.userId === CURRENT_USER_ID &&
      p.matchId === input.matchId &&
      p.leagueId === input.leagueId,
  )
  const ts = new Date().toISOString()
  if (existing) {
    existing.homeScore = input.homeScore
    existing.awayScore = input.awayScore
    existing.booster = input.booster
    existing.updatedAt = ts
  } else {
    predictionsTable.push({
      id: `pred-mock-${Date.now()}`,
      userId: CURRENT_USER_ID,
      matchId: input.matchId,
      leagueId: input.leagueId,
      homeScore: input.homeScore,
      awayScore: input.awayScore,
      booster: input.booster,
      createdAt: ts,
      updatedAt: ts,
    })
  }
  return delay(undefined)
}

export async function quickPredict(input: QuickPredictInput): Promise<void> {
  const ctx = buildPredictionContext(input.matchId)
  if (!ctx) throw new Error(`Match not found: ${input.matchId}`)
  // Updates the score in every league the user is in for this match.
  // Existing boosters are preserved — boosters are managed per-league.
  for (const lg of ctx.leagues) {
    await submitPrediction({
      matchId: input.matchId,
      leagueId: lg.leagueId,
      homeScore: input.homeScore,
      awayScore: input.awayScore,
      booster: lg.currentPrediction?.booster ?? null,
    })
  }
}

export async function createLeague(
  input: CreateLeagueInput,
): Promise<CreateLeagueResult> {
  const id = `lg-mock-${Date.now()}`
  const inviteCode = Math.random().toString(36).slice(2, 8).toUpperCase()
  if (input.competitionIds.length === 0) {
    throw new Error('Pick at least one competition')
  }
  const now = new Date().toISOString()
  const linked = input.competitionIds.map((cid) => {
    const competition = competitions[cid]
    if (!competition) throw new Error(`Competition not found: ${cid}`)
    return {
      competition: {
        id: competition.id,
        name: competition.name,
        code: competition.code,
        emblemUrl: competition.emblemUrl,
        seasonEnd: competition.seasonEnd,
      },
      startDate: now,
    }
  })

  const league: League = {
    id,
    name: input.name,
    description: input.description,
    inviteCode,
    icon: input.icon,
    competitions: linked,
    createdBy: CURRENT_USER_ID,
    settings: input.settings,
    memberCount: 1,
    createdAt: now,
  }
  leaguesTable[id] = league
  return delay({ league, inviteUrl: `eksakt.app/join/${inviteCode}` })
}

export async function joinLeague(input: JoinLeagueInput): Promise<League> {
  // Placeholder: real BE will look up by inviteCode and append a member row.
  throw new Error(`Not implemented (invite ${input.inviteCode})`)
}
