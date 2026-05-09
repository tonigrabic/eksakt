'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Camera,
  Check,
  LogOut,
  AlertCircle,
  Loader2,
  User as UserIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCurrentUser } from '@/hooks/use-current-user'
import {
  useUpdateProfile,
  useUploadAvatar,
} from '@/hooks/use-update-profile'
import { useSignOut } from '@/hooks/use-sign-out'
import { ScreenHeader } from '@/components/screen-header'

const MAX_NAME_LENGTH = 40
const MIN_NAME_LENGTH = 2

export function ProfileScreen() {
  const { data: profile, isLoading } = useCurrentUser()
  const updateProfile = useUpdateProfile()
  const uploadAvatar = useUploadAvatar()
  const signOut = useSignOut()

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [displayName, setDisplayName] = useState('')
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (profile) setDisplayName(profile.displayName)
  }, [profile])

  if (isLoading || !profile) {
    return (
      <>
        <ProfileHeader />
        <div className="max-w-2xl mx-auto px-4 py-10 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </>
    )
  }

  const trimmedName = displayName.trim()
  const nameValid =
    trimmedName.length >= MIN_NAME_LENGTH &&
    trimmedName.length <= MAX_NAME_LENGTH
  const nameDirty = trimmedName !== profile.displayName
  const isBusy =
    updateProfile.isPending || uploadAvatar.isPending || signOut.isPending

  const handleAvatarPick = () => {
    fileInputRef.current?.click()
  }

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    try {
      const url = await uploadAvatar.mutateAsync(file)
      await updateProfile.mutateAsync({ avatarUrl: url })
      setSavedAt(Date.now())
    } catch (err) {
      setError((err as Error).message)
    } finally {
      // Reset the input so picking the same file twice still triggers
      // the change event.
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleSaveName = async () => {
    if (!nameDirty || !nameValid) return
    setError(null)
    try {
      await updateProfile.mutateAsync({ displayName: trimmedName })
      setSavedAt(Date.now())
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const handleSignOut = async () => {
    try {
      await signOut.mutateAsync()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <>
      <ProfileHeader />

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <Card className="bg-card border-border p-6 space-y-6">
          <div className="flex items-center gap-5">
            <button
              type="button"
              onClick={handleAvatarPick}
              disabled={isBusy}
              className={cn(
                'relative h-20 w-20 rounded-full overflow-hidden flex-shrink-0',
                'bg-secondary flex items-center justify-center',
                'border border-border transition-opacity',
                isBusy ? 'opacity-60' : 'hover:opacity-90',
              )}
              aria-label="Change profile picture"
            >
              {profile.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.avatarUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <UserIcon className="h-10 w-10 text-muted-foreground" />
              )}
              <span className="absolute bottom-0 inset-x-0 h-7 bg-black/55 flex items-center justify-center text-[10px] uppercase tracking-wider font-semibold text-white gap-1">
                {uploadAvatar.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Camera className="h-3 w-3" />
                )}
                {uploadAvatar.isPending ? 'Uploading' : 'Change'}
              </span>
            </button>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-foreground truncate">
                {profile.displayName}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {'Tap the photo to change it. JPG, PNG or WebP, up to 2 MB.'}
              </p>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={handleAvatarChange}
            disabled={isBusy}
          />

          <div className="space-y-2">
            <Label htmlFor="displayName" className="text-sm font-medium">
              {'Display name'}
            </Label>
            <Input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={MAX_NAME_LENGTH}
              disabled={isBusy}
              className="bg-background"
            />
            <div className="flex items-center justify-between text-xs">
              <span
                className={cn(
                  'text-muted-foreground',
                  !nameValid && trimmedName.length > 0 && 'text-destructive',
                )}
              >
                {trimmedName.length < MIN_NAME_LENGTH
                  ? `At least ${MIN_NAME_LENGTH} characters`
                  : trimmedName.length > MAX_NAME_LENGTH
                    ? `Max ${MAX_NAME_LENGTH} characters`
                    : 'Visible to other league members'}
              </span>
              <span className="text-muted-foreground tabular-nums">
                {trimmedName.length}/{MAX_NAME_LENGTH}
              </span>
            </div>
            <Button
              onClick={handleSaveName}
              disabled={!nameDirty || !nameValid || isBusy}
              className="w-full"
            >
              {updateProfile.isPending ? 'Saving…' : 'Save changes'}
            </Button>
          </div>

          {savedAt && !error && (
            <div className="flex items-center gap-2 text-xs text-emerald-500">
              <Check className="h-3.5 w-3.5" />
              <span>{'Saved'}</span>
            </div>
          )}
          {error && (
            <div className="flex items-start gap-2 rounded-md bg-destructive/10 border border-destructive/30 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </Card>

        <Card className="bg-card border-border p-4">
          <Button
            variant="ghost"
            className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={handleSignOut}
            disabled={isBusy}
          >
            <LogOut className="h-4 w-4 mr-2" />
            {signOut.isPending ? 'Signing out…' : 'Sign out'}
          </Button>
        </Card>
      </div>
    </>
  )
}

function ProfileHeader() {
  return <ScreenHeader title="Profile" subtitle="Account and preferences" />
}
