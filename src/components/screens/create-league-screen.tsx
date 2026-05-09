'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Trophy, Copy, Check, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCompetitions } from '@/hooks/use-competitions'
import { useCreateLeague } from '@/hooks/use-create-league'
import {
  type Booster,
  type BoosterCounts,
  type Competition,
  MAX_BOOSTER_POOL_PER_TYPE,
} from '@/types'

const BOOSTER_LABELS: Record<Booster, string> = {
  x2: 'Double Points',
  x3: 'Triple Points',
  x5: '5x Points',
}

export function CreateLeagueScreen() {
  const router = useRouter()
  const { data: competitions, isLoading: compsLoading } = useCompetitions()
  const createLeague = useCreateLeague()

  const [leagueName, setLeagueName] = useState('')
  const [competitionIds, setCompetitionIds] = useState<string[]>([])
  const [description, setDescription] = useState('')
  const [boostersEnabled, setBoostersEnabled] = useState(true)
  const [boosterPool, setBoosterPool] = useState<BoosterCounts>({
    x2: 3,
    x3: 1,
    x5: 1,
  })
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const updateBoosterPool = (b: Booster, delta: number) => {
    setBoosterPool((prev) => ({
      ...prev,
      [b]: Math.max(0, Math.min(MAX_BOOSTER_POOL_PER_TYPE, prev[b] + delta)),
    }))
  }

  const toggleCompetition = (id: string) => {
    setCompetitionIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  const selectedCompetitions =
    competitions?.filter((c) => competitionIds.includes(c.id)) ?? []

  const handleCreate = async () => {
    if (competitionIds.length === 0) return
    const result = await createLeague.mutateAsync({
      name: leagueName,
      description: description || null,
      competitionIds,
      icon: null,
      settings: {
        boosters: { enabled: boostersEnabled, pool: boosterPool },
      },
    })
    setInviteUrl(result.inviteUrl)
  }

  const handleCopy = () => {
    if (!inviteUrl) return
    navigator.clipboard.writeText(`https://${inviteUrl}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (inviteUrl) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-8 bg-card border-border space-y-6">
          <div className="text-center space-y-3">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-2">
              <Trophy className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-2xl font-bold text-foreground">
              {'League Created!'}
            </h2>
            <p className="text-muted-foreground text-balance">
              {'Share this link with your friends to invite them'}
            </p>
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-medium text-foreground">
              {'Invite Link'}
            </Label>
            <div className="flex gap-2">
              <Input
                value={inviteUrl}
                readOnly
                className="bg-background font-mono text-sm"
              />
              <Button onClick={handleCopy} size="icon" variant="outline">
                {copied ? (
                  <Check className="h-4 w-4 text-success" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>

            <div className="p-4 bg-muted/50 rounded-lg border border-border">
              <div className="text-sm font-medium text-foreground mb-2">
                {'League Details'}
              </div>
              <div className="space-y-1 text-sm text-muted-foreground">
                <div className="flex justify-between">
                  <span>{'Name:'}</span>
                  <span className="font-medium text-foreground">{leagueName}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span>
                    {selectedCompetitions.length === 1
                      ? 'Competition:'
                      : 'Competitions:'}
                  </span>
                  <span className="font-medium text-foreground text-right">
                    {selectedCompetitions.length === 0
                      ? '—'
                      : selectedCompetitions.map((c) => c.name).join(', ')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>{'Boosters:'}</span>
                  <span className="font-medium text-foreground">
                    {boostersEnabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                {boostersEnabled && (
                  <div className="flex justify-between items-center">
                    <span>{'Pool:'}</span>
                    <div className="flex gap-1">
                      {(['x2', 'x3', 'x5'] as Booster[]).map((b) => (
                        <Badge key={b} variant="secondary" className="text-xs">
                          {b}: {boosterPool[b]}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <Button
            className="w-full"
            size="lg"
            onClick={() => router.push('/leagues')}
          >
            {'Go to My Leagues'}
          </Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pb-6">
      <div className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/leagues')}
            className="mb-2 -ml-2"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {'Back'}
          </Button>
          <h1 className="text-2xl font-bold text-foreground">{'Create League'}</h1>
          <p className="text-sm text-muted-foreground">
            {'Set up a new prediction league for your competition'}
          </p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        <Card className="p-6 bg-card border-border space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm font-medium text-foreground">
              {'League Name'} <span className="text-destructive">{'*'}</span>
            </Label>
            <Input
              id="name"
              placeholder="e.g. Office League, Family Fun"
              value={leagueName}
              onChange={(e) => setLeagueName(e.target.value)}
              className="bg-background"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground">
              {'Select Competitions'} <span className="text-destructive">{'*'}</span>
            </Label>
            <p className="text-xs text-muted-foreground">
              {'Pick one or more. Your league tracks every match in the chosen competitions.'}
            </p>
            <CompetitionPicker
              competitions={competitions ?? []}
              loading={compsLoading}
              selectedIds={competitionIds}
              onToggle={toggleCompetition}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description" className="text-sm font-medium text-foreground">
              {'Description'}{' '}
              <span className="text-muted-foreground font-normal">{'(Optional)'}</span>
            </Label>
            <Textarea
              id="description"
              placeholder="Tell your league members what this league is about..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="bg-background resize-none"
              rows={3}
            />
          </div>

          <div className="space-y-4 pt-4 border-t border-border">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label
                  htmlFor="boosters"
                  className="text-sm font-medium text-foreground flex items-center gap-2"
                >
                  <Zap className="h-4 w-4 text-primary" />
                  {'Enable Boosters'}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {'Allow players to multiply points on specific predictions'}
                </p>
              </div>
              <Switch
                id="boosters"
                checked={boostersEnabled}
                onCheckedChange={setBoostersEnabled}
              />
            </div>

            {boostersEnabled && (
              <Card className="p-4 bg-muted/50 border-border space-y-4">
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-foreground">
                    {'Booster Pool per Player'}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {'Configure how many boosters each player gets for the entire competition'}
                  </p>
                </div>

                {(['x2', 'x3', 'x5'] as Booster[]).map((b) => (
                  <BoosterRow
                    key={b}
                    booster={b}
                    value={boosterPool[b]}
                    onChange={(delta) => updateBoosterPool(b, delta)}
                  />
                ))}
              </Card>
            )}
          </div>

          <Button
            className="w-full"
            size="lg"
            onClick={handleCreate}
            disabled={
              !leagueName ||
              competitionIds.length === 0 ||
              createLeague.isPending
            }
          >
            {createLeague.isPending ? 'Creating…' : 'Create League'}
          </Button>
        </Card>
      </div>
    </div>
  )
}

function CompetitionPicker({
  competitions,
  loading,
  selectedIds,
  onToggle,
}: {
  competitions: Competition[]
  loading: boolean
  selectedIds: string[]
  onToggle: (id: string) => void
}) {
  if (loading) {
    return (
      <div className="rounded-lg border border-border bg-background p-4 text-sm text-muted-foreground">
        {'Loading competitions…'}
      </div>
    )
  }
  if (competitions.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-background p-4 text-sm text-muted-foreground">
        {'No competitions available right now.'}
      </div>
    )
  }
  return (
    <div className="rounded-lg border border-border bg-background divide-y divide-border/40 overflow-hidden">
      {competitions.map((c) => {
        const checked = selectedIds.includes(c.id)
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onToggle(c.id)}
            aria-pressed={checked}
            className={cn(
              'w-full flex items-center gap-3 p-3 text-left transition-colors',
              'hover:bg-muted/40',
              checked && 'bg-primary/5',
            )}
          >
            <span
              className={cn(
                'flex h-5 w-5 items-center justify-center rounded border flex-shrink-0',
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
                {c.name}
              </div>
              <div className="text-xs text-muted-foreground">{c.code}</div>
            </div>
          </button>
        )
      })}
    </div>
  )
}

function BoosterRow({
  booster,
  value,
  onChange,
}: {
  booster: Booster
  value: number
  onChange: (delta: number) => void
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-sm border-primary/50">
          <Zap className="h-3 w-3 mr-1" />
          {booster}
        </Badge>
        <span className="text-sm text-foreground">{BOOSTER_LABELS[booster]}</span>
      </div>
      <div className="flex items-center gap-2">
        <Button
          size="icon"
          variant="outline"
          onClick={() => onChange(-1)}
          disabled={value <= 0}
          className="h-8 w-8"
        >
          {'–'}
        </Button>
        <span className="text-lg font-bold text-foreground w-8 text-center">
          {value}
        </span>
        <Button
          size="icon"
          variant="outline"
          onClick={() => onChange(1)}
          disabled={value >= MAX_BOOSTER_POOL_PER_TYPE}
          className="h-8 w-8"
        >
          {'+'}
        </Button>
      </div>
    </div>
  )
}
