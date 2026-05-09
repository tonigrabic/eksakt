'use client'

import { useQuery } from '@tanstack/react-query'
import { getDashboard } from '@/lib/supabase/api'
import { queryKeys } from '@/lib/query-client'

export function useDashboard() {
  return useQuery({
    queryKey: queryKeys.dashboard,
    queryFn: getDashboard,
  })
}
