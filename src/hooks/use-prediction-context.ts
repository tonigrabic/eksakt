'use client'

import { useQuery } from '@tanstack/react-query'
import { getPredictionContext } from '@/lib/mock/api'
import { queryKeys } from '@/lib/query-client'
import type { UUID } from '@/types'

export function usePredictionContext(matchId: UUID | null) {
  return useQuery({
    queryKey: queryKeys.predictionContext(matchId ?? ''),
    queryFn: () => getPredictionContext(matchId as UUID),
    enabled: Boolean(matchId),
  })
}
