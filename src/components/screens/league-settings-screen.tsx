'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
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
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Copy,
  Plus,
  Trophy,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useLeagueDetail } from '@/hooks/use-league-detail'
import { useCompetitions } from '@/hooks/use-competitions'
import { useAddLeagueCompetition } from '@/hooks/use-add-league-competition'
import { useUpdateLeague } from '@/hooks/use-update-league'
import type { Competition, League, UUID } from '@/types'

interface Props {
  leagueId: UUID
}

export function LeagueSettingsScreen({ leagueId }: Props) {
  const router = useRouter()
  const { data, isLoading } = useLeagueDetail(leagueId)

  if (isLoading || !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-sm text-muted-foreground">{'Loading…'}</p>
      </div>
    )
  }

  const { league, isAdmin } = data

  // Non-admins shouldn't be on this page. Bounce them back. Defensive —
  // the gear icon is only shown to admins, but the route is reachable
  // by URL.
  if (!isAdmin) {
    router.replace(`/leagues/${leagueId}`)
    return null
  }

  return (
    <div className="min-h-screen bg-background pb-6">
      <div className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 -ml-1"
              onClick={() => router.back()}
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">{'Back'}</span>
            </Button>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-bold text-foreground truncate">
                {'Settings'}
              </h1>
              <div className="text-xs text-muted-foreground truncate">
                {league.name}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-6">
        <LeagueInfoSection league={league} />
        <CompetitionsSection league={league} />
        <InviteCodeSection league={league} />
      </div>
    </div>
  )
}

// ── League info (name + icon) ───────────────────────────────────────────────

const NAME_MIN = 1
const NAME_MAX = 80
const ICON_MAX = 4 // emoji can be multi-codepoint; 4 chars is plenty

function LeagueInfoSection({ league }: { league: League }) {
  const update = useUpdateLeague(league.id)
  const [name, setName] = useState(league.name)
  const [icon, setIcon] = useState(league.icon ?? '')
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<number | null>(null)

  // "Dirty" = some field differs from current league state. Hides the
  // Save button until there's something to save.
  const dirty = name.trim() !== league.name || icon.trim() !== (league.icon ?? '')

  const reset = () => {
    setName(league.name)
    setIcon(league.icon ?? '')
    setError(null)
  }

  const handleSave = async () => {
    const trimmedName = name.trim()
    if (trimmedName.length < NAME_MIN || trimmedName.length > NAME_MAX) {
      setError(`Name must be ${NAME_MIN}–${NAME_MAX} characters.`)
      return
    }
    setError(null)
    try {
      await update.mutateAsync({
        leagueId: league.id,
        name: trimmedName,
        // Empty input → null in DB (clears the icon).
        icon: icon.trim() === '' ? null : icon.trim(),
      })
      setSavedAt(Date.now())
      setTimeout(() => setSavedAt(null), 1500)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <section className="space-y-2">
      <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
        {'League Info'}
      </h2>
      <Card className="bg-card border-border p-4 space-y-4">
        <div className="flex gap-3 items-end">
          <div className="space-y-1.5">
            <Label htmlFor="league-icon" className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
              {'Icon'}
            </Label>
            <Input
              id="league-icon"
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              placeholder="🏆"
              maxLength={ICON_MAX}
              className="bg-background w-16 text-center text-xl"
            />
          </div>
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="league-name" className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
              {'Name'}
            </Label>
            <Input
              id="league-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Family Fun"
              maxLength={NAME_MAX}
              className="bg-background"
            />
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground">
          {'Icon is shown next to the league name. Type or paste any emoji, or leave it blank for a trophy.'}
        </p>

        {error && (
          <div className="flex items-start gap-2 rounded-md bg-destructive/10 border border-destructive/30 p-2.5 text-xs text-destructive">
            <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {(dirty || update.isPending) && (
          <div className="flex gap-2 justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={reset}
              disabled={update.isPending}
            >
              {'Cancel'}
            </Button>
            <Button size="sm" onClick={handleSave} disabled={update.isPending}>
              {update.isPending ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        )}

        {savedAt && !dirty && (
          <p className="text-xs text-success flex items-center gap-1">
            <Check className="h-3 w-3" />
            {'Saved'}
          </p>
        )}
      </Card>
    </section>
  )
}

// ── Invite code ─────────────────────────────────────────────────────────────

function InviteCodeSection({ league }: { league: League }) {
  const [copied, setCopied] = useState<'code' | 'link' | null>(null)

  const link = `eksakt.app/join/${league.inviteCode}`

  const copy = async (kind: 'code' | 'link', text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(kind)
      setTimeout(() => setCopied(null), 1500)
    } catch {
      // Clipboard API can fail in non-https contexts; ignore silently.
    }
  }

  return (
    <section className="space-y-2">
      <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
        {'Invite Players'}
      </h2>

      <Card className="bg-card border-border p-4 space-y-4">
        <div className="space-y-2">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">
            {'Code'}
          </p>
          <div className="flex gap-2">
            <Input
              value={league.inviteCode}
              readOnly
              className="bg-background font-mono tracking-widest text-center text-lg"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={() => copy('code', league.inviteCode)}
            >
              {copied === 'code' ? (
                <Check className="h-4 w-4 text-success" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">
            {'Link'}
          </p>
          <div className="flex gap-2">
            <Input
              value={link}
              readOnly
              className="bg-background font-mono text-sm"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={() => copy('link', `https://${link}`)}
            >
              {copied === 'link' ? (
                <Check className="h-4 w-4 text-success" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          {'Anyone with this code can join the league. Share it with friends.'}
        </p>
      </Card>
    </section>
  )
}

// ── Competitions (admin) ────────────────────────────────────────────────────

function CompetitionsSection({ league }: { league: League }) {
  const [open, setOpen] = useState(false)
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
          {league.competitions.length === 1 ? 'Competition' : 'Competitions'}
        </h2>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs h-7 px-2 -mr-1"
          onClick={() => setOpen(true)}
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          {'Add'}
        </Button>
      </div>
      <Card className="bg-card border-border overflow-hidden divide-y divide-border/30">
        {league.competitions.map((lc) => (
          <div
            key={lc.competition.id}
            className="flex items-center gap-3 px-4 py-2.5"
          >
            <div className="h-7 w-7 rounded bg-muted flex items-center justify-center flex-shrink-0">
              <Trophy className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-foreground truncate">
                {lc.competition.name}
              </div>
              <div className="text-[11px] text-muted-foreground">
                {lc.competition.code}
              </div>
            </div>
          </div>
        ))}
      </Card>
      <AddCompetitionDialog
        open={open}
        onOpenChange={setOpen}
        league={league}
      />
    </section>
  )
}

function AddCompetitionDialog({
  open,
  onOpenChange,
  league,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  league: League
}) {
  const { data: allComps, isLoading } = useCompetitions()
  const addComp = useAddLeagueCompetition(league.id)
  const [pickedId, setPickedId] = useState<string | null>(null)

  const linkedIds = new Set(league.competitions.map((lc) => lc.competition.id))
  const available = (allComps ?? []).filter((c) => !linkedIds.has(c.id))

  const handleAdd = async () => {
    if (!pickedId) return
    await addComp.mutateAsync({
      leagueId: league.id,
      competitionId: pickedId,
    })
    setPickedId(null)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{'Add competition'}</DialogTitle>
          <DialogDescription>
            {'Tracking starts now — only matches kicking off after this point will count.'}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-border bg-background divide-y divide-border/40 overflow-hidden max-h-72 overflow-y-auto">
          {isLoading && (
            <div className="p-4 text-sm text-muted-foreground">
              {'Loading…'}
            </div>
          )}
          {!isLoading && available.length === 0 && (
            <div className="p-4 text-sm text-muted-foreground">
              {'No more competitions to add.'}
            </div>
          )}
          {available.map((c) => (
            <CompetitionPickRow
              key={c.id}
              competition={c}
              checked={pickedId === c.id}
              onPick={() => setPickedId(c.id)}
            />
          ))}
        </div>

        {addComp.isError && (
          <p className="text-xs text-destructive">
            {(addComp.error as Error).message}
          </p>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={addComp.isPending}
          >
            {'Cancel'}
          </Button>
          <Button onClick={handleAdd} disabled={!pickedId || addComp.isPending}>
            {addComp.isPending ? 'Adding…' : 'Add competition'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CompetitionPickRow({
  competition,
  checked,
  onPick,
}: {
  competition: Competition
  checked: boolean
  onPick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={checked}
      className={cn(
        'w-full flex items-center gap-3 p-3 text-left transition-colors',
        'hover:bg-muted/40',
        checked && 'bg-primary/5',
      )}
    >
      <span
        className={cn(
          'flex h-5 w-5 items-center justify-center rounded-full border flex-shrink-0',
          checked
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-muted-foreground/40 bg-background',
        )}
      >
        {checked && <Check className="h-3.5 w-3.5" />}
      </span>
      <div className="h-7 w-7 rounded bg-muted flex items-center justify-center flex-shrink-0">
        <Trophy className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-medium text-foreground truncate">
          {competition.name}
        </div>
        <div className="text-xs text-muted-foreground">{competition.code}</div>
      </div>
    </button>
  )
}
