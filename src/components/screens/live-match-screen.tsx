'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  ArrowLeft,
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
import { useMatch } from '@/hooks/use-match'
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
                {match.liveMinute}
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
              <span className="text-4xl font-bold text-foreground tabular-nums">
                {match.homeScore ?? 0}
              </span>
              <span className="text-lg text-muted-foreground">{':'}</span>
              <span className="text-4xl font-bold text-foreground tabular-nums">
                {match.awayScore ?? 0}
              </span>
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
  const isUser = prediction.profile.displayName === 'You'
  const total = prediction.points?.total ?? 0
  const base = prediction.points?.base ?? 0
  const booster = prediction.booster
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
        'flex items-center px-3 py-2.5 rounded-lg border-l-2 text-sm',
        'bg-card border border-border',
        boostBorder,
        boostBg,
        isUser && !booster && 'border-l-primary bg-primary/5',
        isUser && booster && 'bg-primary/5',
      )}
    >
      <div className="flex-1 flex items-center gap-1.5 min-w-0">
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
  const isUser = row.profile.displayName === 'You'
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
        <div className="flex-1 pl-2 flex items-center gap-1.5 min-w-0">
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
          {row.matchdayPoints > 0 ? `+${row.matchdayPoints}` : '0'}
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
