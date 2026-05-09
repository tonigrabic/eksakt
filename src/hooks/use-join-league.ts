'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { joinLeague } from '@/lib/supabase/api'
import type { JoinLeagueInput } from '@/types'

export function useJoinLeague() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: JoinLeagueInput) => joinLeague(input),
    onSuccess: () => qc.invalidateQueries(),
  })
}
