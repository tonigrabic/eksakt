'use client'

import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { queryKeys } from '@/lib/query-client'
import type { UUID } from '@/types'

/**
 * Subscribe to Postgres UPDATEs on the given match row and invalidate
 * the match + league-detail caches whenever its score / status / minute
 * changes. Drives live score updates without polling.
 *
 * The publication is configured in migration 00015 — `matches` is the
 * only user table on `supabase_realtime`.
 */
export function useRealtimeMatch(matchId: UUID | null, leagueId: UUID | null) {
  const qc = useQueryClient()

  useEffect(() => {
    if (!matchId) return
    const supabase = createClient()
    const channel = supabase
      .channel(`match:${matchId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'matches',
          filter: `id=eq.${matchId}`,
        },
        () => {
          if (leagueId) {
            qc.invalidateQueries({ queryKey: queryKeys.match(matchId, leagueId) })
            qc.invalidateQueries({ queryKey: queryKeys.leagueDetail(leagueId) })
          }
          qc.invalidateQueries({ queryKey: queryKeys.dashboard })
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [matchId, leagueId, qc])
}
