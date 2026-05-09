'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { updateLeague } from '@/lib/supabase/api'
import { queryKeys } from '@/lib/query-client'
import type { UpdateLeagueInput, UUID } from '@/types'

/**
 * Update league metadata (name, icon). Refreshes the league detail,
 * dashboard, and my-leagues caches on success since they all surface
 * the league name/icon.
 */
export function useUpdateLeague(leagueId: UUID) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateLeagueInput) => updateLeague(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.leagueDetail(leagueId) })
      qc.invalidateQueries({ queryKey: queryKeys.myLeagues })
      qc.invalidateQueries({ queryKey: queryKeys.dashboard })
    },
  })
}
