'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { signOut } from '@/lib/supabase/api'

/**
 * Sign out and bounce to /login. Wipes the React Query cache so that
 * any stale per-user data (dashboards, leagues, predictions) doesn't
 * flash for the next user signing in on the same browser.
 */
export function useSignOut() {
  const router = useRouter()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: signOut,
    onSuccess: () => {
      qc.clear()
      router.replace('/login')
      router.refresh()
    },
  })
}
