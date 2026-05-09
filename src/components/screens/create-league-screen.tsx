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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ArrowLeft, Trophy, Copy, Check, Zap } from 'lucide-react'
import { useCompetitions } from '@/hooks/use-competitions'
import { useCreateLeague } from '@/hooks/use-create-league'
import {
  type Booster,
  type BoosterCounts,
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
  const [competitionId, setCompetitionId] = useState('')
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

  const selectedCompetition = competitions?.find((c) => c.id === competitionId)

  const handleCreate = async () => {
    if (!competitionId) return
    const result = await createLeague.mutateAsync({
      name: leagueName,
      description: description || null,
      competitionId,
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
                <div className="flex justify-between">
                  <span>{'Competition:'}</span>
                  <span className="font-medium text-foreground">
                    {selectedCompetition?.name ?? competitionId}
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
            <Label htmlFor="competition" className="text-sm font-medium text-foreground">
              {'Select Competition'} <span className="text-destructive">{'*'}</span>
            </Label>
            <Select value={competitionId} onValueChange={setCompetitionId}>
              <SelectTrigger id="competition" className="bg-background">
                <SelectValue
                  placeholder={compsLoading ? 'Loading…' : 'Choose a competition'}
                />
              </SelectTrigger>
              <SelectContent>
                {(competitions ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
              !competitionId ||
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
