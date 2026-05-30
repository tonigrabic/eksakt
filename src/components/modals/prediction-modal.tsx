'use client'

import { useState } from 'react'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card } from '@/components/ui/card'
import { AlertCircle, Minus, Plus, Trophy, Zap, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePredictionContext } from '@/hooks/use-prediction-context'
import {
  useQuickPredict,
  useSubmitPrediction,
} from '@/hooks/use-prediction-mutations'
import {
  BOOSTER_TYPES,
  MAX_SCORE,
  MIN_SCORE,
  type Booster,
  type LeaguePredictionContext,
  type UUID,
} from '@/types'

interface PredictionModalProps {
  matchId: UUID | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onClose: () => void
}

const boosterStyles: Record<Booster, { active: string; inactive: string }> = {
  x2: {
    active: 'bg-emerald-400 text-emerald-950 border-emerald-400',
    inactive: 'border-emerald-400/30 text-emerald-400 hover:bg-emerald-400/10',
  },
  x3: {
    active: 'bg-sky-400 text-sky-950 border-sky-400',
    inactive: 'border-sky-400/30 text-sky-400 hover:bg-sky-400/10',
  },
  x5: {
    active: 'bg-amber-400 text-amber-950 border-amber-400',
    inactive: 'border-amber-400/30 text-amber-400 hover:bg-amber-400/10',
  },
}

function clampScore(v: number): number {
  return Math.max(MIN_SCORE, Math.min(MAX_SCORE, v))
}

// ── Score Stepper ────────────────────────────────────────────────────────────
function ScoreStepper({
  team,
  value,
  onChange,
  compact,
}: {
  team: string
  value: number
  onChange: (v: number) => void
  compact?: boolean
}) {
  return (
    <div className="flex items-center justify-between">
      <span
        className={cn(
          'font-semibold text-foreground truncate flex-1 mr-3',
          compact ? 'text-sm' : 'text-sm',
        )}
      >
        {team}
      </span>
      <div className="flex items-center gap-2 shrink-0">
        <Button
          size="icon"
          variant="outline"
          onClick={() => onChange(clampScore(value - 1))}
          disabled={value <= MIN_SCORE}
          className={cn(compact ? 'h-8 w-8' : 'h-9 w-9', 'rounded-full')}
        >
          <Minus className={cn(compact ? 'h-3 w-3' : 'h-3.5 w-3.5')} />
        </Button>
        <span
          className={cn(
            'font-bold text-foreground text-center tabular-nums',
            compact ? 'text-xl w-7' : 'text-2xl w-9',
          )}
        >
          {value}
        </span>
        <Button
          size="icon"
          variant="outline"
          onClick={() => onChange(clampScore(value + 1))}
          disabled={value >= MAX_SCORE}
          className={cn(compact ? 'h-8 w-8' : 'h-9 w-9', 'rounded-full')}
        >
          <Plus className={cn(compact ? 'h-3 w-3' : 'h-3.5 w-3.5')} />
        </Button>
      </div>
    </div>
  )
}

// ── Per-league row ──────────────────────────────────────────────────────────

type Draft = { home: number; away: number; booster: Booster | null }

function initialDraft(ctx: LeaguePredictionContext): Draft {
  const cur = ctx.currentPrediction
  return cur
    ? { home: cur.homeScore, away: cur.awayScore, booster: cur.booster }
    : { home: 1, away: 0, booster: null }
}

// ── Main Modal ───────────────────────────────────────────────────────────────
//
// PredictionModal is the outer shell: it owns the Drawer + loading state.
// All draft state lives in PredictionForm, which is keyed by matchId so it
// remounts (resetting drafts) when the user opens a different match.
export function PredictionModal({
  matchId,
  open,
  onOpenChange,
  onClose,
}: PredictionModalProps) {
  const { data: context, isLoading } = usePredictionContext(matchId)

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[92vh] bg-card border-border">
        <DrawerHeader className="pb-2">
          <DrawerTitle className="text-lg font-bold text-foreground">
            {'Make Your Prediction'}
          </DrawerTitle>
          <div className="flex items-center justify-center gap-3 text-sm pt-1">
            <span className="font-semibold text-foreground">
              {context?.match.homeTeam?.name ?? '—'}
            </span>
            <span className="text-xs text-muted-foreground">{'vs'}</span>
            <span className="font-semibold text-foreground">
              {context?.match.awayTeam?.name ?? '—'}
            </span>
          </div>
        </DrawerHeader>

        <div className="overflow-y-auto px-4 pb-4 flex-1">
          {!matchId ? null : isLoading || !context ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              {'Loading…'}
            </div>
          ) : context.leagues.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              {"You're not in any league for this competition yet."}
            </div>
          ) : (
            <PredictionForm
              key={matchId}
              matchId={matchId}
              context={context}
              onClose={onClose}
            />
          )}
        </div>
      </DrawerContent>
    </Drawer>
  )
}

// ── Form (state-owning child) ────────────────────────────────────────────────

function PredictionForm({
  matchId,
  context,
  onClose,
}: {
  matchId: UUID
  context: NonNullable<ReturnType<typeof usePredictionContext>['data']>
  onClose: () => void
}) {
  const submitPrediction = useSubmitPrediction()
  const quickPredict = useQuickPredict()

  const homeName = context.match.homeTeam?.name ?? '—'
  const awayName = context.match.awayTeam?.name ?? '—'
  const leagues = context.leagues

  // Seed quick-predict from the first league that already has a pick.
  const seedPick = leagues.find((l) => l.currentPrediction !== null)?.currentPrediction
  const [quickHome, setQuickHome] = useState(seedPick?.homeScore ?? 1)
  const [quickAway, setQuickAway] = useState(seedPick?.awayScore ?? 0)

  const [drafts, setDrafts] = useState<Record<UUID, Draft>>(() => {
    const next: Record<UUID, Draft> = {}
    for (const lg of leagues) next[lg.leagueId] = initialDraft(lg)
    return next
  })

  const updateDraft = (leagueId: UUID, patch: Partial<Draft>) =>
    setDrafts((prev) => ({
      ...prev,
      [leagueId]: { ...prev[leagueId], ...patch },
    }))

  const toggleBooster = (leagueId: UUID, b: Booster) =>
    setDrafts((prev) => ({
      ...prev,
      [leagueId]: {
        ...prev[leagueId],
        booster: prev[leagueId]?.booster === b ? null : b,
      },
    }))

  const isSaving = submitPrediction.isPending || quickPredict.isPending
  const [error, setError] = useState<string | null>(null)

  // Re-check at submit time. The RLS policy guarantees correctness — no
  // prediction ever lands after kickoff — but we want to surface a clean
  // message instead of letting the raw "violates row-level security
  // policy" string bubble up if the user sat on the form past kickoff.
  const isLocked = () =>
    new Date(context.match.kickoffTime).getTime() <= Date.now()

  const handleQuickSave = async () => {
    if (isLocked()) {
      setError('This match has already started — predictions are locked.')
      return
    }
    setError(null)
    try {
      await quickPredict.mutateAsync({
        matchId,
        homeScore: quickHome,
        awayScore: quickAway,
      })
      onClose()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const handlePerLeagueSave = async () => {
    if (isLocked()) {
      setError('This match has already started — predictions are locked.')
      return
    }
    setError(null)
    try {
      await Promise.all(
        leagues.map((lg) => {
          const draft = drafts[lg.leagueId]
          return submitPrediction.mutateAsync({
            matchId,
            leagueId: lg.leagueId,
            homeScore: draft.home,
            awayScore: draft.away,
            booster: draft.booster,
          })
        }),
      )
      onClose()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  // Per-league is the default — quick-predict is the shortcut for "same
  // score everywhere", but per-league is the canonical action (different
  // position context, different boosters per pool).
  return (
    <Tabs defaultValue="custom" className="w-full">
      <TabsList className="grid w-full grid-cols-2 h-9">
        <TabsTrigger value="custom" className="text-xs">
          {'Per League'}
        </TabsTrigger>
        <TabsTrigger value="quick" className="text-xs">
          {'Quick Predict'}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="quick" className="space-y-4 mt-3">
        <Card className="p-4 space-y-4 bg-secondary/50 border-border">
          <ScoreStepper team={homeName} value={quickHome} onChange={setQuickHome} />
          <div className="border-t border-border" />
          <ScoreStepper team={awayName} value={quickAway} onChange={setQuickAway} />
        </Card>

        <p className="text-xs text-muted-foreground text-center">
          {'Updates the score in every league. Boosters stay as set per league.'}
        </p>

        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">
            {'Applies to:'}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {leagues.map((lg) => (
              <Badge
                key={lg.leagueId}
                variant="secondary"
                className="text-xs gap-1 font-normal"
              >
                {lg.leagueIcon && <span>{lg.leagueIcon}</span>}
                {lg.leagueName}
              </Badge>
            ))}
          </div>
        </div>

        {error && <ErrorBanner message={error} />}

        <Button
          className="w-full"
          size="lg"
          onClick={handleQuickSave}
          disabled={isSaving}
        >
          {isSaving ? 'Saving…' : 'Save Prediction'}
        </Button>
      </TabsContent>

      <TabsContent value="custom" className="space-y-3 mt-3">
        {leagues.map((lg) => {
          const draft = drafts[lg.leagueId] ?? initialDraft(lg)
          return (
            <PerLeagueCard
              key={lg.leagueId}
              league={lg}
              draft={draft}
              homeName={homeName}
              awayName={awayName}
              onScoreChange={(field, v) =>
                updateDraft(lg.leagueId, { [field]: v })
              }
              onToggleBooster={(b) => toggleBooster(lg.leagueId, b)}
            />
          )
        })}

        {error && <ErrorBanner message={error} />}

        <Button
          className="w-full"
          size="lg"
          onClick={handlePerLeagueSave}
          disabled={isSaving}
        >
          {isSaving ? 'Saving…' : 'Save All Predictions'}
        </Button>
      </TabsContent>
    </Tabs>
  )
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-md bg-destructive/10 border border-destructive/30 p-2.5 text-xs text-destructive">
      <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
      <span>{message}</span>
    </div>
  )
}

// ── Per-league card ──────────────────────────────────────────────────────────

function PerLeagueCard({
  league,
  draft,
  homeName,
  awayName,
  onScoreChange,
  onToggleBooster,
}: {
  league: LeaguePredictionContext
  draft: Draft
  homeName: string
  awayName: string
  onScoreChange: (field: 'home' | 'away', value: number) => void
  onToggleBooster: (b: Booster) => void
}) {
  const lb = draft.booster
  return (
    <div className="relative pt-2">
      {lb && (
        <div className="absolute top-0 right-4 z-10">
          <span
            className={cn(
              'flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-black shadow-lg',
              lb === 'x5'
                ? 'bg-amber-400 text-amber-950 shadow-amber-400/30'
                : lb === 'x3'
                  ? 'bg-sky-400 text-sky-950 shadow-sky-400/30'
                  : 'bg-emerald-400 text-emerald-950 shadow-emerald-400/30',
            )}
          >
            <Zap className="h-2.5 w-2.5" />
            {lb}
          </span>
        </div>
      )}
      <Card
        className={cn(
          'relative p-3 space-y-3 transition-all duration-300',
          'bg-secondary/30',
          lb === 'x5'
            ? 'border-amber-400/50 shadow-[0_0_16px_-4px] shadow-amber-400/20'
            : lb === 'x3'
              ? 'border-sky-400/50 shadow-[0_0_16px_-4px] shadow-sky-400/20'
              : lb === 'x2'
                ? 'border-emerald-400/50 shadow-[0_0_16px_-4px] shadow-emerald-400/20'
                : 'border-border',
        )}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            {league.leagueIcon && (
              <span className="text-base shrink-0">{league.leagueIcon}</span>
            )}
            <div className="min-w-0">
              <h3 className="font-semibold text-foreground text-sm truncate">
                {league.leagueName}
              </h3>
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <span>{'#'}{league.currentPosition}</span>
                <span className="text-border">{'|'}</span>
                <span>{league.currentPoints}{'pts'}</span>
                {league.leaderGap > 0 && (
                  <>
                    <span className="text-border">{'|'}</span>
                    <span className="text-destructive">
                      {league.leaderGap}{' behind'}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
          {league.leaderGap === 0 && league.currentPosition === 1 && (
            <Badge className="h-5 px-1.5 text-[10px] bg-primary text-primary-foreground shrink-0">
              <Trophy className="h-3 w-3 mr-0.5" />
              {'1st'}
            </Badge>
          )}
        </div>

        <div className="space-y-2.5">
          <ScoreStepper
            team={homeName}
            value={draft.home}
            onChange={(v) => onScoreChange('home', v)}
            compact
          />
          <ScoreStepper
            team={awayName}
            value={draft.away}
            onChange={(v) => onScoreChange('away', v)}
            compact
          />
        </div>

        {league.boostersEnabled && (
          <div className="flex gap-2 pt-0.5">
            {BOOSTER_TYPES.map((b) => {
              // The booster currently saved on THIS match is always
              // reclaimable: the server counts it as "used" (it's stored
              // on the prediction), so we add it back to the pool while
              // editing. Otherwise users couldn't switch off then back to
              // their own booster when remaining is 0.
              const remaining =
                league.boostersRemaining[b] +
                (league.currentPrediction?.booster === b ? 1 : 0)
              const isActive = draft.booster === b
              const styles = boosterStyles[b]
              const exhausted = remaining === 0 && !isActive
              return (
                <button
                  key={b}
                  disabled={exhausted}
                  onClick={() => onToggleBooster(b)}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-1 rounded-full border py-1 text-[11px] font-bold transition-all',
                    exhausted
                      ? 'opacity-30 cursor-not-allowed border-border text-muted-foreground'
                      : isActive
                        ? styles.active
                        : styles.inactive,
                  )}
                >
                  {isActive && <Check className="h-2.5 w-2.5" />}
                  {b}
                  {!isActive && remaining > 0 && (
                    <span className="opacity-60 ml-0.5">
                      {'·'}{remaining}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </Card>
    </div>
  )
}
