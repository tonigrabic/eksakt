'use client'

import { useInfiniteQuery } from '@tanstack/react-query'
import { getRecentMoments } from '@/lib/supabase/api'
import { queryKeys } from '@/lib/query-client'
import type { UUID } from '@/types'

/**
 * Rolling feed of match "stories". Omit `leagueId` for the cross-league
 * dashboard feed; pass it for a single league's Played tab. Flatten pages with
 * `data?.pages.flatMap((p) => p.items)`.
 */
export function useRecentMoments(leagueId?: UUID, limit = 10) {
  return useInfiniteQuery({
    queryKey: queryKeys.recentMoments(leagueId),
    queryFn: ({ pageParam }) =>
      getRecentMoments({ leagueId, limit, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  })
}
