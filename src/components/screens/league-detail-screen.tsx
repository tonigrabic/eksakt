'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  ArrowLeft,
  Trophy,
  Users,
  Clock,
  ChevronRight,
  ChevronDown,
  Circle,
  Zap,
  TrendingUp,
  TrendingDown,
  Minus as MinusIcon,
  CalendarClock,
  Check,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePrediction } from '@/components/prediction-provider'
import { useLeagueDetail } from '@/hooks/use-league-detail'
import { useMatch } from '@/hooks/use-match'
import { formatKickoff, pointsTier } from '@/lib/format'
import type {
  CompletedMatchSummary,
  LiveMatchSummary,
  StandingRow,
  UpcomingMatchSummary,
  UUID,
} from '@/types'

const POINTS_COLOR: Record<ReturnType<typeof pointsTier>, string> = {
  high: 'text-primary',
  mid: 'text-foreground',
  low: 'text-muted-foreground',
  zero: 'text-muted-foreground/50',
}

interface Props {
  leagueId: UUID
}

export function LeagueDetailScreen({ leagueId }: Props) {
  const router = useRouter()
  const { openPrediction } = usePrediction()
  const { data, isLoading } = useLeagueDetail(leagueId)
  const [expandedMatchId, setExpandedMatchId] = useState<UUID | null>(null)

  if (isLoading || !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-sm text-muted-foreground">{'Loading…'}</p>
      </div>
    )
  }

  const { league, standings, liveMatches, upcomingMatches, completedMatches } = data
  const hasLive = liveMatches.length > 0
  const userStanding = standings.find((s) => s.profile.displayName === 'You')
  const unpredictedCount = upcomingMatches.filter(
    (u) => u.userPrediction === null,
  ).length

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
                {league.name}
              </h1>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {league.memberCount} {'players'}
                </span>
                {userStanding && (
                  <>
                    <span className="text-border">{'|'}</span>
                    <span className="font-semibold text-foreground">
                      {'#'}{userStanding.position}
                    </span>
                    <span className="text-border">{'|'}</span>
                    <span className="font-semibold text-foreground">
                      {userStanding.totalPoints + userStanding.matchdayPoints} {'pts'}
                    </span>
                  </>
                )}
              </div>
            </div>
            {hasLive ? (
              <Badge variant="destructive" className="gap-1 text-xs flex-shrink-0">
                <Circle className="h-1.5 w-1.5 fill-current animate-pulse" />
                {liveMatches.length} {'LIVE'}
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-xs flex-shrink-0">
                {'No live'}
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-6">
        {hasLive && (
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Circle className="h-2 w-2 fill-destructive text-destructive animate-pulse" />
              <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                {'Live Matches'}
              </h2>
            </div>

            {liveMatches.map((m) => (
              <LiveMatchCard
                key={m.match.id}
                summary={m}
                leagueId={leagueId}
                expanded={expandedMatchId === m.match.id}
                onToggle={() =>
                  setExpandedMatchId(
                    expandedMatchId === m.match.id ? null : m.match.id,
                  )
                }
              />
            ))}
          </section>
        )}

        {!hasLive && (
          <Card className="bg-card border-border overflow-hidden">
            <div className="p-5 text-center">
              <div className="h-12 w-12 rounded-full bg-secondary flex items-center justify-center mx-auto mb-3">
                <CalendarClock className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-semibold text-foreground">
                {'No live matches right now'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {'Next match kicks off '}
                {upcomingMatches.length > 0 ? (
                  <span className="text-foreground font-medium">
                    {formatKickoff(upcomingMatches[0].match.kickoffTime)}
                  </span>
                ) : (
                  <span>{'soon'}</span>
                )}
              </p>
              {unpredictedCount > 0 && (
                <Button
                  size="sm"
                  className="mt-4 gap-1.5"
                  onClick={() => {
                    const first = upcomingMatches.find(
                      (u) => u.userPrediction === null,
                    )
                    if (first) openPrediction(first.match.id)
                  }}
                >
                  {'Complete Predictions'}
                  <Badge
                    variant="secondary"
                    className="bg-primary-foreground/20 text-primary-foreground ml-1 text-xs px-1.5 py-0"
                  >
                    {unpredictedCount}
                  </Badge>
                </Button>
              )}
            </div>
          </Card>
        )}

        <section className="space-y-3">
          <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            {hasLive ? 'Live Standings' : 'Standings'}
          </h2>
          <StandingsTable standings={standings} hasLive={hasLive} />
        </section>

        {!hasLive && completedMatches.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              {'Recent Results'}
            </h2>
            <Card className="bg-card border-border overflow-hidden divide-y divide-border/30">
              {completedMatches.map((m) => (
                <CompletedMatchRow key={m.match.id} summary={m} />
              ))}
            </Card>
          </section>
        )}

        {upcomingMatches.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                {'Upcoming'}
              </h2>
              {unpredictedCount > 0 && (
                <span className="text-xs font-medium text-primary">
                  {unpredictedCount} {'left to predict'}
                </span>
              )}
            </div>

            {upcomingMatches.map((u) => (
              <UpcomingMatchCard
                key={u.match.id}
                summary={u}
                onPredict={() => openPrediction(u.match.id)}
              />
            ))}
          </section>
        )}
      </div>
    </div>
  )
}

// ── Live match card with on-expand prediction table ─────────────────────────

function LiveMatchCard({
  summary,
  leagueId,
  expanded,
  onToggle,
}: {
  summary: LiveMatchSummary
  leagueId: UUID
  expanded: boolean
  onToggle: () => void
}) {
  const { match, userPrediction } = summary
  const home = match.homeTeam?.name ?? 'TBD'
  const away = match.awayTeam?.name ?? 'TBD'
  const userPts = userPrediction?.points?.total ?? 0
  const hasBooster = userPrediction?.booster != null

  return (
    <Card
      className={cn(
        'bg-card border-border overflow-hidden transition-colors',
        expanded && 'border-primary/30',
      )}
    >
      <button className="w-full text-left" onClick={onToggle}>
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-center justify-between mb-3">
            <Badge variant="destructive" className="gap-1 text-xs">
              <Circle className="h-1.5 w-1.5 fill-current" />
              {match.liveMinute}
            </Badge>
            {userPrediction && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">{'You:'}</span>
                <span className="font-mono font-bold text-foreground">
                  {userPrediction.homeScore}-{userPrediction.awayScore}
                </span>
                <span className="text-muted-foreground">{'='}</span>
                <div className="flex items-center gap-0.5">
                  {hasBooster && <Zap className="h-3 w-3 text-primary" />}
                  <span className={cn('font-bold', POINTS_COLOR[pointsTier(userPts)])}>
                    {userPts > 0 ? `+${userPts}` : '0'}
                  </span>
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center justify-center gap-5">
            <div className="flex-1 text-right">
              <span className="font-bold text-foreground">{home}</span>
            </div>
            <div className="flex items-baseline gap-2.5">
              <span className="text-3xl font-bold text-foreground tabular-nums">
                {match.homeScore ?? 0}
              </span>
              <span className="text-muted-foreground font-medium">{'-'}</span>
              <span className="text-3xl font-bold text-foreground tabular-nums">
                {match.awayScore ?? 0}
              </span>
            </div>
            <div className="flex-1 text-left">
              <span className="font-bold text-foreground">{away}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-center gap-1 px-4 pb-3 text-xs text-muted-foreground">
          <span>
            {expanded
              ? 'Hide predictions'
              : `${summary.predictionCount} predictions`}
          </span>
          <ChevronDown
            className={cn(
              'h-3.5 w-3.5 transition-transform',
              expanded && 'rotate-180',
            )}
          />
        </div>
      </button>

      {expanded && <ExpandedPredictionTable matchId={match.id} leagueId={leagueId} />}

      <div className="px-4 pb-3">
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-xs"
          asChild
        >
          <Link href={`/matches/${match.id}?league=${leagueId}`}>
            {'Open match details'}
            <ChevronRight className="h-3.5 w-3.5 ml-1" />
          </Link>
        </Button>
      </div>
    </Card>
  )
}

function ExpandedPredictionTable({
  matchId,
  leagueId,
}: {
  matchId: UUID
  leagueId: UUID
}) {
  const { data, isLoading } = useMatch(matchId, leagueId)
  if (isLoading || !data) {
    return (
      <div className="border-t border-border px-4 py-6 text-center text-xs text-muted-foreground">
        {'Loading predictions…'}
      </div>
    )
  }
  const sorted = [...data.predictions].sort(
    (a, b) => (b.points?.total ?? 0) - (a.points?.total ?? 0),
  )
  return (
    <div className="border-t border-border">
      <div className="flex items-center text-[11px] text-muted-foreground font-semibold uppercase tracking-wider px-4 py-2 bg-secondary/30">
        <span className="flex-1">{'Player'}</span>
        <span className="w-14 text-center">{'Pick'}</span>
        <span className="w-12 text-center">{'Base'}</span>
        <span className="w-14 text-right">{'Total'}</span>
      </div>
      <div className="divide-y divide-border/30">
        {sorted.map((p) => {
          const isUser = p.profile.displayName === 'You'
          const total = p.points?.total ?? 0
          const base = p.points?.base ?? 0
          const booster = p.booster
          const boostBg =
            booster === 'x5'
              ? 'border-l-amber-400 bg-amber-400/[0.04]'
              : booster === 'x3'
                ? 'border-l-sky-400 bg-sky-400/[0.04]'
                : booster === 'x2'
                  ? 'border-l-emerald-400 bg-emerald-400/[0.04]'
                  : 'border-l-transparent'
          return (
            <div
              key={p.id}
              className={cn(
                'flex items-center pl-4 pr-4 py-2.5 text-sm border-l-2 transition-colors',
                boostBg,
                isUser && !booster && 'bg-primary/5',
                isUser && 'border-l-primary',
              )}
            >
              <div className="flex-1 flex items-center gap-1.5 min-w-0">
                <span
                  className={cn(
                    'font-medium truncate',
                    isUser ? 'text-primary' : 'text-foreground',
                  )}
                >
                  {p.profile.displayName}
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
                {p.homeScore}-{p.awayScore}
              </span>
              <span className="w-12 text-center text-muted-foreground tabular-nums text-xs">
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
        })}
      </div>
    </div>
  )
}

// ── Standings ────────────────────────────────────────────────────────────────

function StandingsTable({
  standings,
  hasLive,
}: {
  standings: StandingRow[]
  hasLive: boolean
}) {
  return (
    <Card className="bg-card border-border overflow-hidden">
      <div className="flex items-center text-[11px] text-muted-foreground font-semibold uppercase tracking-wider px-4 py-2.5 border-b border-border bg-secondary/30">
        <span className="w-7 text-center">{'#'}</span>
        <span className="flex-1 pl-2">{'Player'}</span>
        {hasLive && <span className="w-14 text-center">{'Today'}</span>}
        <span className="w-14 text-right">{'Total'}</span>
        <span className="w-10 text-right">{'Exact'}</span>
        {hasLive && <span className="w-7" />}
      </div>
      <div className="divide-y divide-border/30">
        {standings.map((row) => (
          <StandingRowView key={row.profile.id} row={row} hasLive={hasLive} />
        ))}
      </div>
    </Card>
  )
}

function StandingRowView({
  row,
  hasLive,
}: {
  row: StandingRow
  hasLive: boolean
}) {
  const isUser = row.profile.displayName === 'You'
  return (
    <div
      className={cn(
        'flex items-center px-4 py-2.5 text-sm',
        isUser && 'bg-primary/5',
      )}
    >
      <span
        className={cn(
          'w-7 text-center font-bold tabular-nums text-xs',
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
      {hasLive && (
        <span
          className={cn(
            'w-14 text-center font-mono font-bold text-sm tabular-nums',
            row.matchdayPoints > 0 ? 'text-primary' : 'text-muted-foreground/40',
          )}
        >
          {row.matchdayPoints > 0 ? `+${row.matchdayPoints}` : '0'}
        </span>
      )}
      <span className="w-14 text-right font-bold text-foreground tabular-nums">
        {row.totalPoints + row.matchdayPoints}
      </span>
      <span className="w-10 text-right text-xs text-muted-foreground tabular-nums">
        {row.exactScores}
      </span>
      {hasLive && (
        <div className="w-7 flex justify-center">
          {row.positionChange > 0 && (
            <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
          )}
          {row.positionChange < 0 && (
            <TrendingDown className="h-3.5 w-3.5 text-destructive" />
          )}
          {row.positionChange === 0 && (
            <MinusIcon className="h-3 w-3 text-muted-foreground/30" />
          )}
        </div>
      )}
    </div>
  )
}

// ── Completed match row ──────────────────────────────────────────────────────

function CompletedMatchRow({ summary }: { summary: CompletedMatchSummary }) {
  const { match, userPrediction } = summary
  const home = match.homeTeam?.name ?? 'TBD'
  const away = match.awayTeam?.name ?? 'TBD'
  const homeScore = match.homeScore ?? 0
  const awayScore = match.awayScore ?? 0

  if (!userPrediction) {
    return (
      <div className="px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <Badge variant="secondary" className="text-xs">{match.round.name}</Badge>
          <Badge variant="secondary" className="text-xs gap-1 text-muted-foreground">
            {'No prediction'}
          </Badge>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold">{home}</span>
          <span className="font-bold tabular-nums">{homeScore}-{awayScore}</span>
          <span className="font-semibold">{away}</span>
        </div>
      </div>
    )
  }

  const isExact =
    userPrediction.homeScore === homeScore && userPrediction.awayScore === awayScore
  const correctOutcome =
    Math.sign(userPrediction.homeScore - userPrediction.awayScore) ===
    Math.sign(homeScore - awayScore)
  const total = userPrediction.points?.total ?? 0

  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <Badge variant="secondary" className="text-xs">{match.round.name}</Badge>
        {isExact ? (
          <Badge className="bg-primary/15 text-primary border-0 text-xs gap-1">
            <Check className="h-3 w-3" />
            {'Exact'}
          </Badge>
        ) : correctOutcome ? (
          <Badge variant="secondary" className="text-xs gap-1">
            <Check className="h-3 w-3 text-emerald-500" />
            {'Outcome'}
          </Badge>
        ) : (
          <Badge variant="secondary" className="text-xs gap-1 text-muted-foreground">
            <X className="h-3 w-3 text-destructive" />
            {'Wrong'}
          </Badge>
        )}
      </div>

      <div className="flex items-center gap-4">
        <div className="flex-1">
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold text-foreground">{home}</span>
            <span className="font-bold text-foreground tabular-nums">{homeScore}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold text-foreground">{away}</span>
            <span className="font-bold text-foreground tabular-nums">{awayScore}</span>
          </div>
        </div>
        <div className="w-px h-8 bg-border" />
        <div className="flex flex-col items-end w-16 flex-shrink-0">
          <span className="text-xs text-muted-foreground">
            {userPrediction.homeScore}-{userPrediction.awayScore}
          </span>
          <span
            className={cn(
              'text-sm font-bold tabular-nums',
              POINTS_COLOR[pointsTier(total)],
            )}
          >
            {total > 0 ? `+${total}` : '0'}
          </span>
        </div>
      </div>
    </div>
  )
}

// ── Upcoming match card ──────────────────────────────────────────────────────

function UpcomingMatchCard({
  summary,
  onPredict,
}: {
  summary: UpcomingMatchSummary
  onPredict: () => void
}) {
  const { match, userPrediction } = summary
  const home = match.homeTeam?.name ?? 'TBD'
  const away = match.awayTeam?.name ?? 'TBD'
  return (
    <Card className="p-4 bg-card border-border">
      <div className="flex items-center justify-between mb-2">
        <Badge variant="secondary" className="text-xs">{match.round.name}</Badge>
        <div className="flex items-center gap-1 text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span className="text-xs font-medium">
            {formatKickoff(match.kickoffTime)}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between text-base mb-3">
        <span className="font-semibold text-foreground">{home}</span>
        <span className="text-xs text-muted-foreground">{'vs'}</span>
        <span className="font-semibold text-foreground">{away}</span>
      </div>

      {userPrediction ? (
        <div className="flex items-center justify-between pt-3 border-t border-border">
          <span className="text-xs text-muted-foreground">{'Your prediction'}</span>
          <button
            onClick={onPredict}
            className="flex items-center gap-2"
          >
            <Badge
              variant="outline"
              className="bg-primary/10 text-primary border-primary/20 font-mono font-bold"
            >
              {userPrediction.homeScore}-{userPrediction.awayScore}
            </Badge>
            <span className="text-xs text-muted-foreground hover:text-primary">{'Edit'}</span>
          </button>
        </div>
      ) : (
        <Button className="w-full mt-1" onClick={onPredict}>
          {'Make Prediction'}
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      )}
    </Card>
  )
}

