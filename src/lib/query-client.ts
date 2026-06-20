import { QueryClient } from '@tanstack/react-query'

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
      },
    },
  })
}

// Stable singleton on the client so navigation doesn't blow caches.
let browserClient: QueryClient | undefined
export function getQueryClient() {
  if (typeof window === 'undefined') return makeQueryClient()
  if (!browserClient) browserClient = makeQueryClient()
  return browserClient
}

// Centralized cache keys — typed so renames are safe.
export const queryKeys = {
  currentUser: ['current-user'] as const,
  dashboard: ['dashboard'] as const,
  myLeagues: ['my-leagues'] as const,
  leagueDetail: (leagueId: string) => ['league-detail', leagueId] as const,
  match: (matchId: string, leagueId: string) =>
    ['match', matchId, leagueId] as const,
  predictionContext: (matchId: string) =>
    ['prediction-context', matchId] as const,
  // leagueId omitted → cross-league feed (dashboard); set → single league.
  recentMoments: (leagueId?: string) =>
    ['recent-moments', leagueId ?? 'all'] as const,
}
