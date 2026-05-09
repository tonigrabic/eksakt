'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Trophy,
  Users,
  Clock,
  ChevronRight,
  Circle,
  Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePrediction } from '@/components/prediction-provider'
import { useDashboard } from '@/hooks/use-dashboard'
import { positionLabel } from '@/lib/format'
import type { LeagueDashboardSummary, LiveMatchSummary } from '@/types'

export function DashboardScreen() {
  const { openPrediction } = usePrediction()
  const { data, isLoading } = useDashboard()

  return (
    <>
      <div className="border-b border-border bg-card">
        <div className="max-w-2xl mx-auto px-4 pt-5 pb-4">
          <h1 className="text-xl font-bold text-foreground tracking-tight">
            {'Eksakt'}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {'Your leagues and live matches'}
          </p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        {isLoading || !data ? (
          <p className="text-center text-sm text-muted-foreground py-12">{'Loading…'}</p>
        ) : data.length === 0 ? (
          <Card className="p-8 text-center bg-card border-border">
            <Trophy className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-semibold text-foreground">{'No active leagues yet'}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {'Create one or join with an invite code to start predicting.'}
            </p>
            <Button asChild className="mt-4">
              <Link href="/leagues/create">{'Create League'}</Link>
            </Button>
          </Card>
        ) : (
          data.map((summary) => (
            <DashboardLeagueCard
              key={summary.league.id}
              summary={summary}
              onPredict={openPrediction}
            />
          ))
        )}
      </div>
    </>
  )
}

function DashboardLeagueCard({
  summary,
  onPredict,
}: {
  summary: LeagueDashboardSummary
  onPredict: (matchId: string) => void
}) {
  const { league, liveMatches, upcomingMatches, unpredictedCount } = summary
  const hasLive = liveMatches.length > 0
  const firstUnpredicted = upcomingMatches.find((u) => u.userPrediction === null)

  return (
    <Card className="bg-card border-border overflow-hidden">
      <div className="p-4 pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'h-10 w-10 rounded-lg flex items-center justify-center text-lg',
                hasLive ? 'bg-primary/15' : 'bg-secondary',
              )}
            >
              {league.icon ?? (
                <Trophy
                  className={cn(
                    'h-5 w-5',
                    hasLive ? 'text-primary' : 'text-muted-foreground',
                  )}
                />
              )}
            </div>
            <div>
              <h2 className="font-bold text-foreground">{league.name}</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {league.memberCount}
                </span>
                <span className="text-xs text-muted-foreground">
                  {positionLabel(summary.userPosition)} place
                </span>
                <span className="text-xs font-semibold text-muted-foreground">
                  {summary.userTotalPoints} pts
                </span>
              </div>
            </div>
          </div>
          {hasLive && (
            <Badge variant="destructive" className="gap-1 text-xs flex-shrink-0">
              <Circle className="h-1.5 w-1.5 fill-current animate-pulse" />
              {'LIVE'}
            </Badge>
          )}
        </div>
      </div>

      {hasLive && (
        <div className="mx-4 mb-3 rounded-lg bg-secondary/40 overflow-hidden">
          {liveMatches.map((m, idx) => (
            <DashboardLiveMatchRow key={m.match.id} summary={m} divider={idx > 0} />
          ))}
        </div>
      )}

      <div className="px-4 pb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {unpredictedCount > 0 && firstUnpredicted ? (
            <button
              onClick={() => onPredict(firstUnpredicted.match.id)}
              className="flex items-center gap-1.5 text-primary hover:underline font-medium"
            >
              <Clock className="h-3 w-3" />
              {unpredictedCount} {'to predict'}
            </button>
          ) : upcomingMatches.length > 0 ? (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {upcomingMatches.length} {'upcoming'}
            </span>
          ) : null}
        </div>

        <Button
          variant={hasLive ? 'default' : 'secondary'}
          size="sm"
          className="gap-1"
          asChild
        >
          <Link href={`/leagues/${league.id}`}>
            {'Details'}
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>
    </Card>
  )
}

function DashboardLiveMatchRow({
  summary,
  divider,
}: {
  summary: LiveMatchSummary
  divider: boolean
}) {
  const { match, userPrediction } = summary
  const home = match.homeTeam?.shortName ?? match.homeTeam?.name ?? 'TBD'
  const away = match.awayTeam?.shortName ?? match.awayTeam?.name ?? 'TBD'
  const points = userPrediction?.points?.total ?? 0
  const hasBooster = userPrediction?.booster != null
  const predLabel = userPrediction
    ? `${userPrediction.homeScore}-${userPrediction.awayScore}`
    : '—'

  return (
    <div
      className={cn(
        'px-3 py-2.5 flex items-center gap-3',
        divider && 'border-t border-border/50',
      )}
    >
      <span className="text-xs font-mono text-destructive font-semibold w-10 flex-shrink-0">
        {match.liveMinute}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold text-foreground truncate">{home}</span>
          <span className="font-bold text-foreground tabular-nums mx-1">
            {match.homeScore ?? 0}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold text-foreground truncate">{away}</span>
          <span className="font-bold text-foreground tabular-nums mx-1">
            {match.awayScore ?? 0}
          </span>
        </div>
      </div>
      <div className="w-px h-8 bg-border/60" />
      <div className="flex flex-col items-end flex-shrink-0 w-16">
        <span className="text-xs text-muted-foreground">{predLabel}</span>
        <div className="flex items-center gap-1">
          {hasBooster && <Zap className="h-2.5 w-2.5 text-primary" />}
          <span
            className={cn(
              'text-sm font-bold tabular-nums',
              points >= 4
                ? 'text-primary'
                : points >= 1
                  ? 'text-foreground'
                  : 'text-muted-foreground/50',
            )}
          >
            {points > 0 ? `+${points}` : '0'}
          </span>
        </div>
      </div>
    </div>
  )
}
