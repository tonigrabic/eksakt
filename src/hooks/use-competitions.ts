'use client'

import { useQuery } from '@tanstack/react-query'
import { listCompetitions } from '@/lib/mock/api'

export function useCompetitions() {
  return useQuery({
    queryKey: ['competitions'] as const,
    queryFn: listCompetitions,
  })
}
