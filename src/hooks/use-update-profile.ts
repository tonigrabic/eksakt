'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { updateProfile, uploadAvatar } from '@/lib/supabase/api'
import { queryKeys } from '@/lib/query-client'
import type { Profile, UpdateProfileInput } from '@/types'

/**
 * Patch the current user's profile. On success refreshes the
 * current-user cache so headers/avatars across the app pick up the new
 * values without a hard reload.
 *
 * Standings and league member rows still cache the previous display
 * name until the next refetch; they'll catch up the next time the user
 * loads a league. Cheap and fine for v1.
 */
export function useUpdateProfile() {
  const qc = useQueryClient()
  return useMutation<Profile, Error, UpdateProfileInput>({
    mutationFn: updateProfile,
    onSuccess: (profile) => {
      qc.setQueryData(queryKeys.currentUser, profile)
    },
  })
}

export function useUploadAvatar() {
  return useMutation<string, Error, File>({
    mutationFn: uploadAvatar,
  })
}
