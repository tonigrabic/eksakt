'use client'

import Link from 'next/link'
import { Card } from '@/components/ui/card'
import {
  Trophy,
  Clock,
  ChevronRight,
  Zap,
  Plus,
  Hash,
  Target,
  Star,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePrediction } from '@/components/prediction-provider'
import { ScreenHeader } from '@/components/screen-header'
import { CreateOrJoinLeague } from '@/components/create-or-join-league'
import { HelpDialog } from '@/components/help-dialog'
import { useDashboard } from '@/hooks/use-dashboard'
import { useLiveMinute } from '@/hooks/use-live-minute'
import { Crest, teamName } from '@/components/match-ui'
import type {
  LeagueDashboardSummary,
  LiveMatchSummary,
  StandingRow,
} from '@/types'

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
          <p className="text-center text-sm text-muted-foreground py-12">
            {'Loading…'}
          </p>
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

// ── League card ──────────────────────────────────────────────────────────────

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
  const leagueHref = `/leagues/${league.id}`

  return (
    <div className="rounded-[14px] border border-border bg-card overflow-hidden">
      <Link
        href={leagueHref}
        className="block transition-colors hover:bg-white/[0.02]"
      >
        {/* header */}
        <div className="flex items-center gap-3 p-4 pb-3.5">
          <div
            className={cn(
              'size-12 rounded-[12px] grid place-items-center text-2xl shrink-0',
              hasLive ? 'bg-primary/15' : 'bg-secondary',
            )}
          >
            {league.icon ?? (
              <Trophy
                className={cn(
                  'size-6',
                  hasLive ? 'text-primary' : 'text-muted-foreground',
                )}
              />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-display text-[24px] font-extrabold uppercase leading-none tracking-[0.005em] text-foreground truncate">
              {league.name}
            </h2>
            <div className="mt-1.5 flex items-center gap-2 text-[12px] text-muted-foreground">
              <span>
                {league.memberCount} {'players'}
              </span>
              <span className="text-dim">{'·'}</span>
              <span className="font-mono font-semibold text-foreground">
                {'#'}
                {summary.userPosition}
              </span>
              <span className="text-dim">{'·'}</span>
              <span className="font-mono font-semibold text-foreground">
                {summary.userTotalPoints} {'pts'}
              </span>
              {summary.userMatchdayPoints > 0 && (
                <span className="font-mono font-bold text-primary">
                  {'▲ +'}
                  {summary.userMatchdayPoints}
                </span>
              )}
            </div>
          </div>
          {hasLive ? (
            <span className="inline-flex items-center gap-[5px] bg-destructive text-foreground rounded-full px-[11px] py-[5px] text-[11px] font-extrabold tracking-[0.1em] shrink-0">
              <span className="size-[5px] rounded-full bg-current animate-pulse" />
              {liveMatches.length} {'LIVE'}
            </span>
          ) : (
            <ChevronRight className="size-5 text-muted-foreground shrink-0" />
          )}
        </div>

        {/* live games */}
        {hasLive && (
          <div className="px-3.5 pb-1">
            <DashSectionLabel>{'Live'}</DashSectionLabel>
            <div className="space-y-2">
              {liveMatches.map((m) => (
                <DashLiveRow key={m.match.id} summary={m} />
              ))}
            </div>
          </div>
        )}

        {/* (live) standings preview — shown alongside live games too */}
        {summary.standingsPreview.length > 0 && (
          <div className="px-3.5 pt-2 pb-3.5">
            <DashSectionLabel>
              {hasLive ? 'Live standings' : 'Standings'}
            </DashSectionLabel>
            <div className="rounded-[10px] border border-border overflow-hidden">
              <DashStandingsPreview rows={summary.standingsPreview} />
            </div>
          </div>
        )}
      </Link>

      {/* footer (outside the link so the predict button doesn't nest) */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-border">
        {unpredictedCount > 0 && firstUnpredicted ? (
          <button
            type="button"
            onClick={() => onPredict(firstUnpredicted.match.id)}
            className="inline-flex items-center gap-1.5 text-[12px] font-bold text-primary hover:underline"
          >
            <Clock className="size-3.5" />
            {unpredictedCount} {'to predict'}
          </button>
        ) : upcomingMatches.length > 0 ? (
          <span className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground">
            <Clock className="size-3.5" />
            {upcomingMatches.length} {'upcoming'}
          </span>
        ) : (
          <span />
        )}

        <Link
          href={leagueHref}
          className="inline-flex items-center gap-1 text-[12px] font-semibold text-foreground hover:text-primary transition-colors"
        >
          {'Open league'}
          <ChevronRight className="size-4" />
        </Link>
      </div>
    </div>
  )
}

function DashSectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-0.5 pt-1 pb-2 text-[9px] font-extrabold uppercase tracking-[0.18em] text-muted-foreground">
      {children}
    </div>
  )
}

// ── Live row ─────────────────────────────────────────────────────────────────

function DashLiveRow({ summary }: { summary: LiveMatchSummary }) {
  const { match, userPrediction } = summary
  const liveMinute = useLiveMinute(
    match.liveMinute,
    match.status,
    match.kickoffTime,
  )
  const pts = userPrediction?.points?.total ?? 0
  const exact = userPrediction?.points?.base === 4
  const ptsColor = exact
    ? 'text-primary'
    : pts > 0
      ? 'text-foreground'
      : 'text-dim'
  const pick = userPrediction
    ? `${userPrediction.homeScore}–${userPrediction.awayScore}`
    : '—'

  return (
    <div className="flex items-center gap-3 px-3.5 py-3 rounded-[12px] border border-border bg-[oklch(0.115_0.005_30)]">
      <span className="w-10 shrink-0 font-mono text-[12px] font-extrabold text-destructive">
        {liveMinute ?? 'LIVE'}
      </span>
      <div className="flex-1 min-w-0 space-y-2">
        <ScoreLine team={match.homeTeam} score={match.homeScore ?? 0} />
        <ScoreLine team={match.awayTeam} score={match.awayScore ?? 0} />
      </div>
      <div className="w-px self-stretch bg-border" />
      <div className="flex flex-col items-end w-[58px] shrink-0">
        <span className="font-mono text-[12px] text-muted-foreground">
          {pick}
        </span>
        <span
          className={cn(
            'font-display text-[26px] font-black leading-none tracking-[-0.02em]',
            ptsColor,
          )}
        >
          {pts > 0 ? `+${pts}` : '0'}
        </span>
      </div>
    </div>
  )
}

function ScoreLine({
  team,
  score,
}: {
  team: LiveMatchSummary['match']['homeTeam']
  score: number
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="flex items-center gap-2.5 min-w-0">
        <Crest team={team} size="sm" />
        <span className="font-display text-[16px] font-extrabold uppercase leading-none truncate">
          {teamName(team)}
        </span>
      </span>
      <span className="font-display text-[24px] font-extrabold leading-none tabular-nums">
        {score}
      </span>
    </div>
  )
}

// ── Compact standings preview (top 3 + you) ──────────────────────────────────

function DashStandingsPreview({ rows }: { rows: StandingRow[] }) {
  return (
    <div>
      {rows.map((row, idx) => {
        const prev = rows[idx - 1]
        const gap = prev && row.position - prev.position > 1
        return (
          <div key={row.profile.id}>
            {gap && (
              <div className="px-3.5 py-1 text-center text-dim text-[13px] leading-none tracking-[0.3em] border-b border-border select-none">
                {'···'}
              </div>
            )}
            <DashStandingsRow row={row} />
          </div>
        )
      })}
    </div>
  )
}

function DashStandingsRow({ row }: { row: StandingRow }) {
  const isUser = row.isCurrentUser
  const total = row.totalPoints + row.matchdayPoints
  return (
    <div
      className={cn(
        'flex items-center gap-2.5 py-[9px] pr-3.5 text-[14px] border-b border-border last:border-b-0',
        isUser
          ? 'bg-primary/10 border-l-[3px] border-l-primary pl-[11px]'
          : 'pl-3.5',
      )}
    >
      <span
        className={cn(
          'w-[26px] font-display text-[22px] font-extrabold leading-none tracking-[-0.02em]',
          isUser
            ? 'text-primary'
            : row.position === 1
              ? 'text-primary'
              : row.position <= 3
                ? 'text-foreground'
                : 'text-dim',
        )}
      >
        {row.position}
      </span>
      <span
        className={cn(
          'flex-1 inline-flex items-center gap-1.5 min-w-0',
          isUser ? 'text-foreground font-bold' : 'font-medium',
        )}
      >
        {row.position === 1 && (
          <Star className="size-[13px] fill-primary text-primary shrink-0" />
        )}
        <span className="truncate">{row.profile.displayName}</span>
      </span>
      {row.matchdayPoints > 0 && (
        <span className="font-mono text-[12px] font-bold text-primary">
          {`+${row.matchdayPoints}`}
        </span>
      )}
      <span
        className={cn(
          'font-display text-[22px] font-extrabold leading-none tracking-[-0.02em]',
          isUser ? 'text-primary' : 'text-foreground',
        )}
      >
        {total}
      </span>
    </div>
  )
}

// ── Empty state ──────────────────────────────────────────────────────────────

function WelcomeEmptyState() {
  return (
    <Card className="p-6 bg-card border-border rounded-[14px]">
      <div className="flex items-center gap-3 mb-1">
        <div className="size-10 rounded-[10px] bg-primary/15 grid place-items-center">
          <Trophy className="size-5 text-primary" />
        </div>
        <div>
          <h2 className="font-display text-[22px] font-extrabold uppercase leading-none tracking-[0.005em] text-foreground">
            {'Welcome to Eksakt'}
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            {'Predict the exact score. Beat your friends.'}
          </p>
        </div>
      </div>

      <ol className="mt-4 space-y-3">
        <WelcomeStep
          n={1}
          icon={<Plus className="size-3.5" />}
          title="Create a league"
          body="Pick a competition, name your league, invite your friends with the auto-generated code."
        />
        <WelcomeStep
          n={2}
          icon={<Hash className="size-3.5" />}
          title="Or join with a code"
          body="Have a code from a friend? Tap Join below — you’ll be in the league immediately."
        />
        <WelcomeStep
          n={3}
          icon={<Target className="size-3.5" />}
          title="Predict scores before kickoff"
          body="Everyone’s picks stay hidden until the match starts. Points roll in live."
        />
      </ol>

      <div className="mt-5 rounded-[10px] border border-border bg-secondary/30 p-3 space-y-1.5 text-xs">
        <div className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-muted-foreground mb-1.5">
          {'Scoring'}
        </div>
        <ScoringRow label="Correct outcome (W / D / L)" value="1 pt" />
        <ScoringRow label="Exact score" value="+3 pts" />
        <ScoringRow label="Lone or rare outcome (<5%)" value="+3 pts" />
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground pt-1">
          <Zap className="size-3 text-primary" />
          <span>{'Boosters (×2 / ×3 / ×5) multiply the match total.'}</span>
        </div>
      </div>

      <div className="mt-5">
        <CreateOrJoinLeague />
      </div>
    </Card>
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
      <div className="relative size-7 rounded-full bg-secondary text-muted-foreground grid place-items-center shrink-0 mt-0.5">
        {icon}
        <span className="absolute -top-1 -right-1 size-4 rounded-full bg-primary text-primary-foreground text-[9px] font-bold grid place-items-center">
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
