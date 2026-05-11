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
  Plus,
  Hash,
  Target,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePrediction } from '@/components/prediction-provider'
import { ScreenHeader } from '@/components/screen-header'
import { CreateOrJoinLeague } from '@/components/create-or-join-league'
import { HelpDialog } from '@/components/help-dialog'
import { useDashboard } from '@/hooks/use-dashboard'
import { useLiveMinute } from '@/hooks/use-live-minute'
import { positionLabel } from '@/lib/format'
import type {
  LeagueDashboardSummary,
  LiveMatchSummary,
  StandingRow,
} from '@/types'

function WelcomeEmptyState() {
  return (
    <div className="space-y-4">
      <Card className="p-6 bg-card border-border">
        <div className="flex items-center gap-3 mb-1">
          <div className="h-10 w-10 rounded-lg bg-primary/15 flex items-center justify-center">
            <Trophy className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">
              {'Welcome to Eksakt'}
            </h2>
            <p className="text-xs text-muted-foreground">
              {'Predict the exact score. Beat your friends.'}
            </p>
          </div>
        </div>

        <ol className="mt-4 space-y-3">
          <WelcomeStep
            n={1}
            icon={<Plus className="h-3.5 w-3.5" />}
            title="Create a league"
            body="Pick a competition, name your league, invite your friends with the auto-generated code."
          />
          <WelcomeStep
            n={2}
            icon={<Hash className="h-3.5 w-3.5" />}
            title="Or join with a code"
            body="Have a code from a friend? Tap Join below — you’ll be in the league immediately."
          />
          <WelcomeStep
            n={3}
            icon={<Target className="h-3.5 w-3.5" />}
            title="Predict scores before kickoff"
            body="Everyone’s picks stay hidden until the match starts. Points roll in live."
          />
        </ol>

        <div className="mt-5 rounded-lg border border-border bg-secondary/30 p-3 space-y-1.5 text-xs">
          <div className="text-foreground font-semibold uppercase tracking-wider text-[10px] mb-1.5">
            {'Scoring'}
          </div>
          <ScoringRow label="Correct outcome (W / D / L)" value="1 pt" />
          <ScoringRow label="Exact score" value="+3 pts" />
          <ScoringRow label="Lone or rare outcome (<5%)" value="+3 pts" />
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground pt-1">
            <Zap className="h-3 w-3 text-primary" />
            <span>{'Boosters (×2 / ×3 / ×5) multiply the match total.'}</span>
          </div>
        </div>

        <div className="mt-5">
          <CreateOrJoinLeague />
        </div>
      </Card>
    </div>
  )
}

function ScoringRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-muted-foreground">
      <span>{label}</span>
      <span className="font-mono font-bold text-foreground">{value}</span>
    </div>
  )
}

function WelcomeStep({
  n,
  icon,
  title,
  body,
}: {
  n: number
  icon: React.ReactNode
  title: string
  body: string
}) {
  return (
    <li className="flex gap-3">
      <div className="relative h-7 w-7 rounded-full bg-secondary text-muted-foreground flex items-center justify-center flex-shrink-0 mt-0.5">
        {icon}
        <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center">
          {n}
        </span>
      </div>
      <div className="min-w-0">
        <div className="text-sm font-semibold text-foreground">{title}</div>
        <div className="text-xs text-muted-foreground leading-relaxed">
          {body}
        </div>
      </div>
    </li>
  )
}

export function DashboardScreen() {
  const { openPrediction } = usePrediction()
  const { data, isLoading } = useDashboard()

  return (
    <>
      <ScreenHeader
        title="Eksakt"
        subtitle="Your leagues and live matches"
        action={<HelpDialog />}
      />

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        {isLoading || !data ? (
          <p className="text-center text-sm text-muted-foreground py-12">{'Loading…'}</p>
        ) : data.length === 0 ? (
          <WelcomeEmptyState />
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
      {summary.standingsPreview.length > 0 && (
        <div className="mx-4 mb-3 rounded-lg bg-secondary/40 overflow-hidden">
          <DashboardStandingsPreview rows={summary.standingsPreview} />
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
  const liveMinute = useLiveMinute(match.liveMinute, match.status, match.kickoffTime)

  return (
    <div
      className={cn(
        'px-3 py-2.5 flex items-center gap-3',
        divider && 'border-t border-border/50',
      )}
    >
      <span className="text-xs font-mono text-destructive font-semibold w-10 flex-shrink-0">
        {liveMinute ?? 'LIVE'}
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

// Compact standings preview for the no-live state of a dashboard card.
// Receives top 3 + (optionally) the user's own row when they're outside
// the top 3 — we render an ellipsis row between rank 3 and the user's
// row to make the gap visible.
function DashboardStandingsPreview({ rows }: { rows: StandingRow[] }) {
  return (
    <div className="divide-y divide-border/40">
      {rows.map((row, idx) => {
        const prev = rows[idx - 1]
        const isGap = prev && row.position - prev.position > 1
        return (
          <div key={row.profile.id}>
            {isGap && (
              <div className="px-3 py-1 text-center text-[10px] text-muted-foreground/50 tracking-widest">
                {'…'}
              </div>
            )}
            <DashboardStandingsRow row={row} />
          </div>
        )
      })}
    </div>
  )
}

function DashboardStandingsRow({ row }: { row: StandingRow }) {
  const isUser = row.isCurrentUser
  const total = row.totalPoints + row.matchdayPoints
  const liveDelta = row.matchdayPoints
  return (
    <div
      className={cn(
        'flex items-center px-3 py-2 text-sm gap-2',
        isUser && 'bg-primary/5',
      )}
    >
      <span
        className={cn(
          'w-5 text-center font-bold text-xs tabular-nums',
          row.position === 1 && 'text-primary',
          row.position > 3 && 'text-muted-foreground',
        )}
      >
        {row.position}
      </span>
      <span
        className={cn(
          'flex-1 truncate font-medium',
          isUser ? 'text-primary' : 'text-foreground',
        )}
      >
        {row.profile.displayName}
      </span>
      {liveDelta > 0 && (
        <span className="text-[10px] font-bold text-primary tabular-nums">
          {`+${liveDelta}`}
        </span>
      )}
      <span className="font-bold text-foreground tabular-nums">{total}</span>
      <span className="text-[10px] text-muted-foreground">{'pts'}</span>
    </div>
  )
}
