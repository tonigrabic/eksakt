'use client'

import { useQuery } from '@tanstack/react-query'
import { getCurrentUser } from '@/lib/supabase/api'
import { queryKeys } from '@/lib/query-client'

/**
 * Fetch the authenticated user's profile. Throws downstream if not
 * signed in — the (app) layout's middleware should have redirected long
 * before this is rendered.
 */
export function useCurrentUser() {
  return useQuery({
    queryKey: queryKeys.currentUser,
    queryFn: getCurrentUser,
  })
}
