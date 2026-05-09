'use client'

import { useQuery } from '@tanstack/react-query'
import { getMatchDetail } from '@/lib/mock/api'
import { queryKeys } from '@/lib/query-client'
import type { UUID } from '@/types'

export function useMatch(matchId: UUID, leagueId: UUID) {
  return useQuery({
    queryKey: queryKeys.match(matchId, leagueId),
    queryFn: () => getMatchDetail(matchId, leagueId),
    enabled: Boolean(matchId) && Boolean(leagueId),
  })
}
