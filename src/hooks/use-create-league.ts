'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createLeague } from '@/lib/mock/api'
import type { CreateLeagueInput } from '@/types'

export function useCreateLeague() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateLeagueInput) => createLeague(input),
    onSuccess: () => qc.invalidateQueries(),
  })
}
