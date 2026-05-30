'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  ArrowLeft,
  ChevronDown,
  Circle,
  TrendingUp,
  TrendingDown,
  Trophy,
  Zap,
  Minus as MinusIcon,
  Info,
} from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { useCurrentUser } from '@/hooks/use-current-user'
import { useMatch } from '@/hooks/use-match'
import { useRealtimeMatch } from '@/hooks/use-realtime-match'
import { useLiveMinute } from '@/hooks/use-live-minute'
import { AnimatedScore } from '@/components/animated-score'
import { Avatar } from '@/components/match-ui'
import { pointsTier } from '@/lib/format'
import type {
  BestScoreSuggestion,
  PredictionWithDetails,
  StandingRow,
  UUID,
} from '@/types'

const POINTS_COLOR: Record<ReturnType<typeof pointsTier>, string> = {
  high: 'text-primary',
  mid: 'text-foreground',
  low: 'text-muted-foreground',
  zero: 'text-muted-foreground/50',
}

interface Props {
  matchId: UUID
  leagueId: UUID
}

export function LiveMatchScreen({ matchId, leagueId }: Props) {
  const router = useRouter()
  const { data, isLoading } = useMatch(matchId, leagueId)
  const [activeTab, setActiveTab] = useState('predictions')

  // Push score / status updates from the sync-live-matches edge function
  // into the cache the moment they hit Postgres. Skipped for finished
  // matches — nothing more is coming.
  useRealtimeMatch(data?.match.status === 'finished' ? null : matchId, leagueId)

  // Hooks must be called unconditionally; tolerate undefined inputs
  // while the match payload is loading.
  const liveMinute = useLiveMinute(
    data?.match.liveMinute,
    data?.match.status,
    data?.match.kickoffTime,
  )

  if (isLoading || !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-sm text-muted-foreground">{'Loading…'}</p>
      </div>
    )
  }

  const { match, league, predictions, userPrediction, bestScoresForUser, standings } = data
  const home = match.homeTeam?.name ?? 'TBD'
  const away = match.awayTeam?.name ?? 'TBD'
  const sortedPreds = [...predictions].sort(
    (a, b) => (b.points?.total ?? 0) - (a.points?.total ?? 0),
  )

  return (
    <div className="min-h-screen bg-background pb-6">
      <div className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.back()}
              className="-ml-2 h-8"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              {league.name}
            </Button>
            {match.status === 'live' ? (
              <Badge variant="destructive" className="gap-1 text-xs">
                <Circle className="h-1.5 w-1.5 fill-current animate-pulse" />
                {liveMinute ?? 'LIVE'}
              </Badge>
            ) : match.status === 'finished' ? (
              <Badge variant="secondary" className="text-xs">{'Full Time'}</Badge>
            ) : (
              <Badge variant="secondary" className="text-xs">{'Upcoming'}</Badge>
            )}
          </div>

          <div className="flex items-center justify-center gap-6">
            <div className="text-right flex-1">
              <div className="text-base font-bold text-foreground">{home}</div>
            </div>
            <div className="flex items-center gap-3">
              <AnimatedScore
                value={match.homeScore ?? 0}
                className="text-4xl font-bold text-foreground"
              />
              <span className="text-lg text-muted-foreground">{':'}</span>
              <AnimatedScore
                value={match.awayScore ?? 0}
                className="text-4xl font-bold text-foreground"
              />
            </div>
            <div className="text-left flex-1">
              <div className="text-base font-bold text-foreground">{away}</div>
            </div>
          </div>

          <div className="text-center text-xs text-muted-foreground mt-1">
            {match.round.name}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="predictions">{'Predictions'}</TabsTrigger>
            <TabsTrigger value="best">{'Best for You'}</TabsTrigger>
            <TabsTrigger value="standings">{'Standings'}</TabsTrigger>
          </TabsList>

          <TabsContent value="predictions" className="space-y-1">
            {match.status === 'scheduled' ? (
              <p className="text-xs text-muted-foreground">
                {"Predictions are blind until kickoff."}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground mb-3">
                {'Points based on current score '}
                {match.homeScore ?? 0}-{match.awayScore ?? 0}
                {'. '}
                {sortedPreds.length} {'predictions.'}
              </p>
            )}

            {sortedPreds.length > 0 && (
              <>
                <div className="flex items-center text-xs text-muted-foreground px-3 pb-2 font-medium">
                  <span className="flex-1">{'Player'}</span>
                  <span className="w-14 text-center">{'Pick'}</span>
                  <span className="w-10 text-center">{'Base'}</span>
                  <span className="w-14 text-right">{'Total'}</span>
                </div>
                <div className="space-y-1">
                  {sortedPreds.map((p) => (
                    <PredictionRow key={p.id} prediction={p} />
                  ))}
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="best" className="space-y-3">
            {!userPrediction ? (
              <p className="text-xs text-muted-foreground">
                {"You haven't predicted this match yet."}
              </p>
            ) : (
              <>
                <p className="text-xs text-muted-foreground mb-3">
                  {'Your prediction: '}
                  <span className="font-bold text-foreground">
                    {userPrediction.homeScore}-{userPrediction.awayScore}
                  </span>
                  {userPrediction.booster && (
                    <>
                      {' with '}
                      <span className="text-primary font-bold">
                        {userPrediction.booster}
                      </span>
                      {' booster'}
                    </>
                  )}
                </p>
                {bestScoresForUser.map((s, idx) => (
                  <BestScoreCard key={idx} suggestion={s} />
                ))}
              </>
            )}

            <Card className="p-4 bg-secondary/30 border-border">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-1">
                    {'Scoring'}
                  </h3>
                  <ul className="text-xs text-muted-foreground space-y-0.5">
                    <li>{'1 pt correct outcome (W/D/L)'}</li>
                    <li>{'+3 pts exact score'}</li>
                    <li>{'+3 pts if <5% predicted that outcome'}</li>
                    <li>{'+3 pts if <5% predicted that exact score'}</li>
                    <li>{'Boosters multiply total after all bonuses'}</li>
                  </ul>
                </div>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="standings" className="space-y-1">
            <p className="text-xs text-muted-foreground mb-3">
              {league.name}{' — live positions based on current scores'}
            </p>

            <div className="flex items-center text-xs text-muted-foreground px-3 pb-2 font-medium">
              <span className="w-7 text-center">{'#'}</span>
              <span className="flex-1 pl-2">{'Player'}</span>
              <span className="w-12 text-center">{'Today'}</span>
              <span className="w-14 text-right">{'Total'}</span>
              <span className="w-7" />
            </div>
            <div className="space-y-1">
              {standings.map((row) => (
                <StandingCardRow key={row.profile.id} row={row} />
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

// ── Sub-components ───────────────────────────────────────────────────────────

function PredictionRow({ prediction }: { prediction: PredictionWithDetails }) {
  const { data: currentUser } = useCurrentUser()
  const isUser = prediction.userId === currentUser?.id
  const points = prediction.points
  const total = points?.total ?? 0
  const base = points?.base ?? 0
  const booster = prediction.booster
  // Audit fields are populated only on persisted points (i.e. after the
  // SQL trigger fired on a finished match). Live matches show the
  // expander button disabled / hidden.
  const hasAudit = points?.memberCount != null
  const [showAudit, setShowAudit] = useState(false)

  const boostBorder =
    booster === 'x5'
      ? 'border-l-amber-400'
      : booster === 'x3'
        ? 'border-l-sky-400'
        : booster === 'x2'
          ? 'border-l-emerald-400'
          : 'border-l-transparent'
  const boostBg =
    booster === 'x5'
      ? 'bg-amber-400/[0.04]'
      : booster === 'x3'
        ? 'bg-sky-400/[0.04]'
        : booster === 'x2'
          ? 'bg-emerald-400/[0.04]'
          : ''

  return (
    <div
      className={cn(
        'rounded-lg border-l-2',
        'bg-card border border-border',
        boostBorder,
        boostBg,
        isUser && !booster && 'border-l-primary bg-primary/5',
        isUser && booster && 'bg-primary/5',
      )}
    >
      <div className="flex items-center px-3 py-2.5 text-sm">
        <div className="flex-1 flex items-center gap-2 min-w-0">
          <Avatar profile={prediction.profile} size="sm" />
          <span
            className={cn(
              'font-medium truncate',
              isUser ? 'text-primary' : 'text-foreground',
            )}
          >
            {prediction.profile.displayName}
          </span>
          {booster && (
            <span
              className={cn(
                'flex-shrink-0 inline-flex items-center gap-0.5 rounded-full px-1.5 py-px text-[9px] font-black leading-tight',
                booster === 'x5'
                  ? 'bg-amber-400/15 text-amber-400'
                  : booster === 'x3'
                    ? 'bg-sky-400/15 text-sky-400'
                    : 'bg-emerald-400/15 text-emerald-400',
              )}
            >
              <Zap className="h-2 w-2" />
              {booster}
            </span>
          )}
        </div>
        <span className="w-14 text-center font-mono font-bold text-foreground">
          {prediction.homeScore}-{prediction.awayScore}
        </span>
        <span className="w-10 text-center text-muted-foreground tabular-nums">
          {base}
        </span>
        <span
          className={cn(
            'w-14 text-right font-bold tabular-nums',
            POINTS_COLOR[pointsTier(total)],
          )}
        >
          {total > 0 ? `+${total}` : '0'}
        </span>
        {hasAudit ? (
          <button
            type="button"
            onClick={() => setShowAudit((v) => !v)}
            aria-label={showAudit ? 'Hide breakdown' : 'Show breakdown'}
            className="ml-2 p-1 text-muted-foreground/60 hover:text-foreground transition-colors"
          >
            <ChevronDown
              className={cn(
                'h-3.5 w-3.5 transition-transform',
                showAudit && 'rotate-180',
              )}
            />
          </button>
        ) : (
          <span className="ml-2 w-5" />
        )}
      </div>
      {showAudit && hasAudit && points && <PredictionAudit points={points} />}
    </div>
  )
}

function PredictionAudit({ points }: { points: NonNullable<PredictionWithDetails['points']> }) {
  // points fields are guaranteed defined here because hasAudit gated rendering
  const memberCount = points.memberCount ?? 0
  const sameOutcome = points.sameOutcomeCount ?? 0
  const sameExact = points.sameExactCount ?? 0
  const outcomePct = points.outcomePct ?? 0
  const exactPct = points.exactPct ?? 0

  return (
    <div className="border-t border-border/50 px-3 py-2 text-[11px] text-muted-foreground space-y-1.5 bg-secondary/20 rounded-b-lg">
      <Row
        label={
          points.base === 4
            ? 'Exact score'
            : points.base === 1
              ? 'Correct outcome'
              : 'Wrong outcome'
        }
        value={`${points.base} pt${points.base === 1 ? '' : 's'}`}
      />
      {points.outcomeBonus > 0 && (
        <Row
          label={`Outcome rarity (${sameOutcome} of ${memberCount} = ${outcomePct.toFixed(1)}%)`}
          value={`+${points.outcomeBonus}`}
        />
      )}
      {points.exactBonus > 0 && (
        <Row
          label={`Exact rarity (${sameExact} of ${memberCount} = ${exactPct.toFixed(1)}%)`}
          value={`+${points.exactBonus}`}
        />
      )}
      {points.multiplier > 1 && (
        <Row
          label={`Booster ×${points.multiplier}`}
          value={`× ${points.multiplier}`}
        />
      )}
      <div className="border-t border-border/50 mt-1.5 pt-1.5 flex justify-between font-bold text-foreground">
        <span>{'Total'}</span>
        <span className="tabular-nums">{points.total}</span>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span>{label}</span>
      <span className="tabular-nums font-mono text-foreground/80">{value}</span>
    </div>
  )
}

function BestScoreCard({ suggestion }: { suggestion: BestScoreSuggestion }) {
  const { homeScore, awayScore, isCurrentScore, hypotheticalPoints, reasoning } = suggestion
  return (
    <Card
      className={cn(
        'p-4 bg-card border-border',
        isCurrentScore && 'border-primary/40 bg-primary/5',
      )}
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl font-bold font-mono text-foreground">
              {homeScore}-{awayScore}
            </span>
            {isCurrentScore && (
              <Badge variant="default" className="text-xs">
                {'Current Score'}
              </Badge>
            )}
          </div>
          <span className="text-xs text-muted-foreground">{reasoning}</span>
        </div>
        <div className="text-right">
          <div
            className={cn(
              'text-3xl font-bold tabular-nums',
              hypotheticalPoints.total > 0
                ? 'text-primary'
                : 'text-muted-foreground/40',
            )}
          >
            {hypotheticalPoints.total}
          </div>
          <div className="text-xs text-muted-foreground">{'pts'}</div>
        </div>
      </div>
    </Card>
  )
}

function StandingCardRow({ row }: { row: StandingRow }) {
  const isUser = row.isCurrentUser
  return (
    <Card
      className={cn(
        'px-3 py-2.5 bg-card border-border',
        isUser && 'border-primary/40 bg-primary/5',
      )}
    >
      <div className="flex items-center text-sm">
        <span
          className={cn(
            'w-7 text-center font-bold tabular-nums',
            row.position === 1 && 'text-primary',
            row.position <= 3 && row.position !== 1 && 'text-foreground',
            row.position > 3 && 'text-muted-foreground',
          )}
        >
          {row.position}
        </span>
        <div className="flex-1 pl-2 flex items-center gap-2 min-w-0">
          <Avatar profile={row.profile} size="md" />
          {row.position === 1 && (
            <Trophy className="h-3.5 w-3.5 text-primary flex-shrink-0" />
          )}
          <span
            className={cn(
              'font-medium truncate',
              isUser ? 'text-primary' : 'text-foreground',
            )}
          >
            {row.profile.displayName}
          </span>
          {row.boostersUsed > 0 && (
            <Zap className="h-3 w-3 text-primary/60 flex-shrink-0" />
          )}
        </div>
        <span
          className={cn(
            'w-12 text-center font-mono font-bold tabular-nums',
            row.matchdayPoints > 0 ? 'text-primary' : 'text-muted-foreground/40',
          )}
        >
          {row.matchdayPoints > 0 ? `+${row.matchdayPoints}` : '—'}
        </span>
        <span className="w-14 text-right font-bold text-foreground tabular-nums">
          {row.totalPoints + row.matchdayPoints}
        </span>
        <div className="w-7 flex justify-center">
          {row.positionChange > 0 && (
            <TrendingUp className="h-3.5 w-3.5 text-success" />
          )}
          {row.positionChange < 0 && (
            <TrendingDown className="h-3.5 w-3.5 text-destructive" />
          )}
          {row.positionChange === 0 && (
            <MinusIcon className="h-3 w-3 text-muted-foreground/30" />
          )}
        </div>
      </div>
    </Card>
  )
}
