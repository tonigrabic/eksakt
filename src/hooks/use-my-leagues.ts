'use client'

import { useQuery } from '@tanstack/react-query'
import { getMyLeagues } from '@/lib/supabase/api'
import { queryKeys } from '@/lib/query-client'

export function useMyLeagues() {
  return useQuery({
    queryKey: queryKeys.myLeagues,
    queryFn: getMyLeagues,
  })
}
