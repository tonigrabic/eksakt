'use client'

// Shared "Create + Join" pair. Lives anywhere a user might want to start
// or enter a league — currently the My Leagues screen and the Dashboard
// empty state. Wrapped in one component so the two paths can never drift.
//
// The Join action talks to the join_league_by_code RPC via useJoinLeague;
// it's atomic + idempotent, and routes to /leagues/<id> on success.

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { AlertCircle, Hash, Plus } from 'lucide-react'
import { useJoinLeague } from '@/hooks/use-join-league'

export function CreateOrJoinLeague() {
  return (
    <div className="grid grid-cols-2 gap-2">
      <Button size="lg" asChild>
        <Link href="/leagues/create">
          <Plus className="h-4 w-4 mr-1.5" />
          {'Create'}
        </Link>
      </Button>
      <JoinLeagueButton />
    </div>
  )
}

function JoinLeagueButton() {
  const router = useRouter()
  const join = useJoinLeague()
  const [open, setOpen] = useState(false)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)

  function reset() {
    setCode('')
    setError(null)
  }

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault()
    const trimmed = code.trim()
    if (trimmed.length < 4) {
      setError('Codes are at least 4 characters.')
      return
    }
    setError(null)
    try {
      const league = await join.mutateAsync({ inviteCode: trimmed })
      setOpen(false)
      reset()
      router.push(`/leagues/${league.id}`)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) reset()
      }}
    >
      <Button size="lg" variant="secondary" onClick={() => setOpen(true)}>
        <Hash className="h-4 w-4 mr-1.5" />
        {'Join'}
      </Button>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{'Join with invite code'}</DialogTitle>
          <DialogDescription>
            {'Paste the code your friend shared with you.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="invite-code">{'Invite code'}</Label>
            <Input
              id="invite-code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ABC123"
              autoFocus
              maxLength={12}
              className="bg-background font-mono tracking-widest text-center text-lg"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
            />
          </div>
          {error && (
            <div className="flex items-start gap-2 rounded-md bg-destructive/10 border border-destructive/30 p-2.5 text-xs text-destructive">
              <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={join.isPending}
            >
              {'Cancel'}
            </Button>
            <Button
              type="submit"
              disabled={join.isPending || code.trim().length < 4}
            >
              {join.isPending ? 'Joining…' : 'Join League'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
