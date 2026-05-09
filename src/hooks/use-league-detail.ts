'use client'

import { useQuery } from '@tanstack/react-query'
import { getLeagueDetail } from '@/lib/mock/api'
import { queryKeys } from '@/lib/query-client'
import type { UUID } from '@/types'

export function useLeagueDetail(leagueId: UUID) {
  return useQuery({
    queryKey: queryKeys.leagueDetail(leagueId),
    queryFn: () => getLeagueDetail(leagueId),
    enabled: Boolean(leagueId),
  })
}
