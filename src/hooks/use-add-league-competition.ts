'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { addLeagueCompetition } from '@/lib/supabase/api'
import { queryKeys } from '@/lib/query-client'
import type { AddLeagueCompetitionInput } from '@/types'

/**
 * Attach an additional competition to an existing league. Admin-only —
 * RLS rejects non-admins. On success we invalidate the league detail
 * query so the new comp's matches flow into the UI immediately.
 */
export function useAddLeagueCompetition(leagueId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: AddLeagueCompetitionInput) =>
      addLeagueCompetition(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.leagueDetail(leagueId) })
      qc.invalidateQueries({ queryKey: queryKeys.dashboard })
      qc.invalidateQueries({ queryKey: queryKeys.myLeagues })
    },
  })
}
