'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { removeLeagueMember } from '@/lib/supabase/api'
import { queryKeys } from '@/lib/query-client'
import type { RemoveLeagueMemberInput } from '@/types'

/**
 * Admin-only: kick a member from a league. On success, refreshes the
 * league detail (member list + standings) and the dashboard (in case
 * the league's member count is displayed elsewhere).
 */
export function useRemoveLeagueMember(leagueId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: RemoveLeagueMemberInput) => removeLeagueMember(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.leagueDetail(leagueId) })
      qc.invalidateQueries({ queryKey: queryKeys.dashboard })
      qc.invalidateQueries({ queryKey: queryKeys.myLeagues })
    },
  })
}
