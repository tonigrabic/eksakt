'use client'

// Shared invite-friends modal. Triggered from the league board (header
// icon, solo inline card) and the dashboard solo league card. Shows the
// invite code + a join URL with Copy + Share actions. Share uses the
// Web Share API on supported devices and falls back to copy-link.

import { useState } from 'react'
import { Check, Copy, Share2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  leagueName: string
  inviteCode: string
}

export function InviteFriendsModal({
  open,
  onOpenChange,
  leagueName,
  inviteCode,
}: Props) {
  const [copiedCode, setCopiedCode] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)

  const inviteUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/join/${inviteCode}`
      : `/join/${inviteCode}`

  async function copy(
    text: string,
    setter: (v: boolean) => void,
  ): Promise<void> {
    try {
      await navigator.clipboard.writeText(text)
      setter(true)
      setTimeout(() => setter(false), 1500)
    } catch {
      // Clipboard blocked — silently no-op; user can still triple-click
      // the displayed code/url to select.
    }
  }

  async function share(): Promise<void> {
    const text = `Join my Eksakt league "${leagueName}":\n${inviteUrl}`
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await navigator.share({ title: leagueName, text, url: inviteUrl })
        return
      } catch {
        // User cancelled the share sheet — do nothing.
        return
      }
    }
    // No share API → copy link is the next-best UX.
    await copy(inviteUrl, setCopiedLink)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display text-[20px] font-extrabold uppercase tracking-[0.005em]">
            {'Invite friends'}
          </DialogTitle>
          <DialogDescription>
            {'Send this code or link so they can join '}
            <span className="text-foreground font-semibold">{leagueName}</span>
            {'.'}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-[12px] border border-border bg-secondary/40 px-4 py-5 text-center">
          <div className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-muted-foreground mb-2">
            {'Invite code'}
          </div>
          <div className="font-mono font-extrabold text-[34px] tracking-[0.2em] text-foreground">
            {inviteCode}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="secondary"
            onClick={() => copy(inviteCode, setCopiedCode)}
          >
            {copiedCode ? (
              <Check className="size-4 mr-1.5" />
            ) : (
              <Copy className="size-4 mr-1.5" />
            )}
            {copiedCode ? 'Copied' : 'Copy code'}
          </Button>
          <Button
            variant="secondary"
            onClick={() => copy(inviteUrl, setCopiedLink)}
          >
            {copiedLink ? (
              <Check className="size-4 mr-1.5" />
            ) : (
              <Copy className="size-4 mr-1.5" />
            )}
            {copiedLink ? 'Copied' : 'Copy link'}
          </Button>
        </div>

        <Button onClick={share} size="lg">
          <Share2 className="size-4 mr-2" />
          {'Share invite'}
        </Button>
      </DialogContent>
    </Dialog>
  )
}
