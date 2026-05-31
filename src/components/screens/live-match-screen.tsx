'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ChevronDown, Star, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCurrentUser } from '@/hooks/use-current-user'
import { useMatch } from '@/hooks/use-match'
import { useRealtimeMatch } from '@/hooks/use-realtime-match'
import { useLiveMinute } from '@/hooks/use-live-minute'
import { AnimatedScore } from '@/components/animated-score'
import {
  Avatar,
  BOOSTER_PILL,
  BoosterPill,
  Crest,
  teamName,
} from '@/components/match-ui'
import type {
  PredictionWithDetails,
  StandingRow,
  UUID,
} from '@/types'

// Match detail deep view. Same "Stadium Broadcast" vocabulary as the
// league board (`league-detail-screen.tsx`) so the two never look
// disconnected when you tap into a match. Local mirrors of SectionHead /
// TabButton / StandingsTable are intentional — extracting them is a
// separate refactor.

interface Props {
  matchId: UUID
  leagueId: UUID
}

export function LiveMatchScreen({ matchId, leagueId }: Props) {
  const router = useRouter()
  const { data, isLoading } = useMatch(matchId, leagueId)
  const [tab, setTab] = useState<'predictions' | 'standings'>('predictions')

  // Push score / status updates from the sync-live-matches edge function
  // into the cache the moment they hit Postgres. Skipped for finished
  // matches — nothing more is coming.
  useRealtimeMatch(data?.match.status === 'finished' ? null : matchId, leagueId)

  // Hooks must run unconditionally — tolerate undefined inputs while
  // the match payload is loading.
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

  const { match, league, predictions, userPrediction, standings } = data
  const sortedPreds = [...predictions].sort(
    (a, b) =>
      (b.points?.total ?? 0) - (a.points?.total ?? 0) ||
      a.profile.displayName.localeCompare(b.profile.displayName),
  )

  const isLive = match.status === 'live'
  const isFinished = match.status === 'finished'

  return (
    <div className="min-h-screen bg-background pb-8 tabular-nums">
      {/* ── Top bar ───────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 bg-background border-b border-border">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-[10px]">
          <button
            type="button"
            onClick={() => router.back()}
            className="grid place-items-center size-[30px] rounded-[8px] text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors shrink-0"
          >
            <ArrowLeft className="size-4" />
            <span className="sr-only">{'Back'}</span>
          </button>
          <div className="flex-1 min-w-0">
            <div className="font-display text-[18px] font-black uppercase leading-none tracking-[0.005em] text-foreground truncate">
              {league.name}
            </div>
            <div className="text-[10px] text-muted-foreground mt-[3px] tracking-[0.12em] uppercase font-semibold truncate">
              {match.round.name}
            </div>
          </div>
          {isLive ? (
            <span className="inline-flex items-center gap-[5px] bg-destructive text-foreground rounded-full px-[10px] py-[5px] text-[10px] font-extrabold tracking-[0.1em] shrink-0">
              <span className="size-[5px] rounded-full bg-current animate-pulse" />
              {liveMinute ?? 'LIVE'}
            </span>
          ) : isFinished ? (
            <span className="inline-flex items-center bg-secondary text-muted-foreground rounded-full px-[10px] py-[5px] text-[10px] font-bold tracking-[0.1em] uppercase border border-border shrink-0">
              {'Full time'}
            </span>
          ) : (
            <span className="inline-flex items-center bg-secondary text-muted-foreground rounded-full px-[10px] py-[5px] text-[10px] font-bold tracking-[0.1em] uppercase border border-border shrink-0">
              {'Upcoming'}
            </span>
          )}
        </div>
      </div>

      {/* ── Hero scoreboard ───────────────────────────────────────────── */}
      <div className="border-b border-border">
        <div className="max-w-2xl mx-auto px-[14px] py-[22px]">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-[14px]">
            <div className="flex flex-col items-center gap-[10px] min-w-0">
              <Crest team={match.homeTeam} size="lg" />
              <span className="font-display text-[18px] font-extrabold uppercase tracking-[0.01em] leading-none text-center">
                {teamName(match.homeTeam)}
              </span>
            </div>
            <div className="flex items-center gap-1 leading-none text-foreground">
              {match.status === 'scheduled' ? (
                <span className="font-display text-[44px] font-extrabold uppercase tracking-[0.14em] text-dim">
                  {'VS'}
                </span>
              ) : (
                <>
                  <AnimatedScore
                    value={match.homeScore ?? 0}
                    className="font-display text-[64px] font-black leading-[0.85] tracking-[-0.04em]"
                  />
                  <span className="font-display text-[36px] font-bold text-dim px-1 -translate-y-1">
                    {':'}
                  </span>
                  <AnimatedScore
                    value={match.awayScore ?? 0}
                    className="font-display text-[64px] font-black leading-[0.85] tracking-[-0.04em]"
                  />
                </>
              )}
            </div>
            <div className="flex flex-col items-center gap-[10px] min-w-0">
              <Crest team={match.awayTeam} size="lg" />
              <span className="font-display text-[18px] font-extrabold uppercase tracking-[0.01em] leading-none text-center">
                {teamName(match.awayTeam)}
              </span>
            </div>
          </div>

          {/* Your pick strip */}
          {userPrediction && match.status !== 'scheduled' && (
            <YourPickStrip prediction={userPrediction} />
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4">
        {/* Tabs */}
        <div className="pt-[22px]">
          <div className="grid grid-cols-2 bg-card border border-border rounded-[10px] p-1">
            <TabButton
              active={tab === 'predictions'}
              count={sortedPreds.length}
              onClick={() => setTab('predictions')}
            >
              {'Predictions'}
            </TabButton>
            <TabButton
              active={tab === 'standings'}
              count={standings.length}
              onClick={() => setTab('standings')}
            >
              {'Standings'}
            </TabButton>
          </div>

          <div className="pt-3">
            {tab === 'predictions' ? (
              <PredictionsList
                predictions={sortedPreds}
                isScheduled={match.status === 'scheduled'}
                live={isLive}
                homeScore={match.homeScore}
                awayScore={match.awayScore}
              />
            ) : (
              <>
                <SectionHead
                  title={league.name}
                  meta={isLive ? 'Live positions' : 'Standings'}
                  live={isLive}
                />
                <StandingsTable standings={standings} hasLive={isLive} />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Section head ─────────────────────────────────────────────────────────────
// Local mirror of the league-board SectionHead. Same look.

function SectionHead({
  title,
  meta,
  live = false,
}: {
  title: string
  meta?: string
  live?: boolean
}) {
  return (
    <div className="flex items-center gap-[10px] mb-3">
      <span className="font-display text-[16px] font-extrabold uppercase tracking-[0.04em] text-foreground inline-flex items-center gap-2">
        {live && (
          <span className="size-[6px] rounded-full bg-destructive animate-pulse" />
        )}
        {title}
      </span>
      <span className="flex-1 h-px bg-border" />
      {meta && (
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] font-semibold text-dim">
          {meta}
        </span>
      )}
    </div>
  )
}

// ── Tab button ───────────────────────────────────────────────────────────────

function TabButton({
  active,
  count,
  onClick,
  children,
}: {
  active: boolean
  count: number
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center justify-center gap-2 py-[10px] rounded-[7px] font-display text-[15px] font-extrabold uppercase tracking-[0.08em] transition-colors',
        active
          ? 'bg-foreground text-background'
          : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
      <span
        className={cn(
          'font-mono text-[10px] font-bold rounded-full px-[7px] py-px normal-case tracking-normal',
          active ? 'bg-background text-foreground' : 'bg-secondary text-muted-foreground',
        )}
      >
        {count}
      </span>
    </button>
  )
}

// ── Your pick strip ──────────────────────────────────────────────────────────

function YourPickStrip({
  prediction,
}: {
  prediction: PredictionWithDetails
}) {
  const booster = prediction.booster
  const userPts = prediction.points?.total ?? 0
  return (
    <div className="mt-[18px] grid grid-cols-[auto_1fr_auto] gap-[14px] items-center px-[14px] py-[11px] rounded-[12px] border border-dashed border-hair-strong bg-[oklch(0.105_0.003_60)]">
      <span className="text-[9px] font-extrabold uppercase tracking-[0.22em] text-muted-foreground">
        {'Your pick'}
      </span>
      <span className="inline-flex items-center gap-2">
        <span className="font-display text-[26px] font-extrabold leading-[0.9] tracking-[-0.02em]">
          {prediction.homeScore}
          {'–'}
          {prediction.awayScore}
        </span>
        {booster && <BoosterPill booster={booster} />}
      </span>
      <span className="flex flex-col items-end gap-px">
        <span className="text-[9px] font-extrabold uppercase tracking-[0.18em] text-muted-foreground">
          {'Points'}
        </span>
        <span className="font-display text-[32px] font-black text-primary leading-[0.85] tracking-[-0.03em]">
          {userPts > 0 ? `+${userPts}` : '0'}
        </span>
      </span>
    </div>
  )
}

// ── Predictions list ─────────────────────────────────────────────────────────

function PredictionsList({
  predictions,
  isScheduled,
  live,
  homeScore,
  awayScore,
}: {
  predictions: PredictionWithDetails[]
  isScheduled: boolean
  live: boolean
  homeScore: number | null
  awayScore: number | null
}) {
  if (isScheduled) {
    return (
      <div className="rounded-[12px] border border-border bg-card px-5 py-8 text-center">
        <p className="text-sm font-semibold text-foreground">
          {'Predictions are blind until kickoff'}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {"You'll see everyone's picks the moment the match goes live."}
        </p>
      </div>
    )
  }
  if (predictions.length === 0) {
    return (
      <div className="rounded-[12px] border border-border bg-card px-5 py-8 text-center">
        <p className="text-sm text-muted-foreground">
          {'No predictions for this match.'}
        </p>
      </div>
    )
  }

  const scoreLabel =
    homeScore !== null && awayScore !== null ? `${homeScore}–${awayScore}` : null

  return (
    <>
      <SectionHead
        title={live ? 'Picks · Live' : 'Picks'}
        meta={scoreLabel ? `Against ${scoreLabel}` : undefined}
        live={live}
      />
      <div className="bg-card border border-border rounded-[12px] overflow-hidden">
        <div className="grid grid-cols-[26px_1fr_56px_36px_56px_20px] items-center px-[14px] py-[10px] border-b border-border text-[9px] font-extrabold uppercase tracking-[0.18em] text-muted-foreground">
          <span>{'#'}</span>
          <span>{'Player'}</span>
          <span className="text-center">{'Pick'}</span>
          <span className="text-center">{'Base'}</span>
          <span className="text-right">{'Total'}</span>
          <span />
        </div>
        {predictions.map((p, i) => (
          <PredictionRow key={p.id} prediction={p} rank={i + 1} />
        ))}
      </div>
    </>
  )
}

function PredictionRow({
  prediction,
  rank,
}: {
  prediction: PredictionWithDetails
  rank: number
}) {
  const { data: currentUser } = useCurrentUser()
  const isUser = prediction.userId === currentUser?.id
  const points = prediction.points
  const total = points?.total ?? 0
  const base = points?.base ?? 0
  // Audit fields are populated only on persisted points (i.e. after the
  // SQL trigger fired on a finished match). Live rows show no audit.
  const hasAudit = points?.memberCount != null
  const [showAudit, setShowAudit] = useState(false)

  const totalColor =
    base === 4
      ? 'text-primary'
      : total > 0
        ? 'text-foreground'
        : 'text-dim'

  return (
    <>
      <div
        className={cn(
          'grid grid-cols-[26px_1fr_56px_36px_56px_20px] items-center py-[11px] pr-[14px] border-b border-border last:border-b-0 text-[13px]',
          isUser
            ? 'bg-primary/10 border-l-[3px] border-l-primary pl-[11px]'
            : 'pl-[14px]',
        )}
      >
        <span className="font-mono text-[11px] text-dim text-center">
          {rank}
        </span>
        <span className="inline-flex items-center gap-[8px] min-w-0">
          <Avatar profile={prediction.profile} size="sm" />
          <span
            className={cn(
              'truncate',
              isUser ? 'text-foreground font-bold' : 'font-medium',
            )}
          >
            {prediction.profile.displayName}
          </span>
          {prediction.booster && (
            <span
              className={cn(
                'inline-flex items-center gap-0.5 rounded-[4px] px-1 py-px text-[10px] font-black leading-none shrink-0',
                BOOSTER_PILL[prediction.booster],
              )}
            >
              <Zap className="size-[9px] fill-current" />
              {'×'}
              {prediction.booster.slice(1)}
            </span>
          )}
        </span>
        <span className="font-mono text-[12px] text-muted-foreground text-center tabular-nums">
          {prediction.homeScore}
          {'–'}
          {prediction.awayScore}
        </span>
        <span className="font-mono text-[12px] text-muted-foreground text-center tabular-nums">
          {base}
        </span>
        <span
          className={cn(
            'font-display text-[18px] font-extrabold tracking-[-0.02em] text-right tabular-nums',
            totalColor,
          )}
        >
          {total > 0 ? `+${total}` : '·'}
        </span>
        {hasAudit ? (
          <button
            type="button"
            onClick={() => setShowAudit((v) => !v)}
            aria-label={showAudit ? 'Hide breakdown' : 'Show breakdown'}
            className="ml-auto p-1 text-muted-foreground/60 hover:text-foreground transition-colors"
          >
            <ChevronDown
              className={cn(
                'size-[14px] transition-transform',
                showAudit && 'rotate-180',
              )}
            />
          </button>
        ) : (
          <span />
        )}
      </div>
      {showAudit && hasAudit && points && (
        <PredictionAudit
          points={points}
          isUser={isUser}
        />
      )}
    </>
  )
}

function PredictionAudit({
  points,
  isUser,
}: {
  points: NonNullable<PredictionWithDetails['points']>
  isUser: boolean
}) {
  const memberCount = points.memberCount ?? 0
  const sameOutcome = points.sameOutcomeCount ?? 0
  const sameExact = points.sameExactCount ?? 0
  const outcomePct = points.outcomePct ?? 0
  const exactPct = points.exactPct ?? 0

  return (
    <div
      className={cn(
        'px-[14px] py-[10px] border-b border-border last:border-b-0 text-[11px] space-y-[5px] bg-secondary/30',
        isUser && 'bg-primary/[0.07]',
      )}
    >
      <AuditRow
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
        <AuditRow
          label={`Outcome rarity (${sameOutcome}/${memberCount} · ${outcomePct.toFixed(1)}%)`}
          value={`+${points.outcomeBonus}`}
        />
      )}
      {points.exactBonus > 0 && (
        <AuditRow
          label={`Exact rarity (${sameExact}/${memberCount} · ${exactPct.toFixed(1)}%)`}
          value={`+${points.exactBonus}`}
        />
      )}
      {points.multiplier > 1 && (
        <AuditRow
          label={`Booster ×${points.multiplier}`}
          value={`× ${points.multiplier}`}
        />
      )}
      <div className="border-t border-border mt-[7px] pt-[7px] flex justify-between font-display text-[13px] font-extrabold uppercase tracking-[0.04em] text-foreground">
        <span>{'Total'}</span>
        <span className="tabular-nums">{points.total}</span>
      </div>
    </div>
  )
}

function AuditRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-muted-foreground">
      <span>{label}</span>
      <span className="font-mono tabular-nums text-foreground/80">{value}</span>
    </div>
  )
}

// ── Standings table ──────────────────────────────────────────────────────────
// Local mirror of the league-board StandingsTable, with one difference:
// here we always render every row. On the league board the table is one
// section of a long page so it condenses for big leagues; this screen is
// the standings deep view, so collapsing it would hide the thing the user
// came for.

function StandingsTable({
  standings,
  hasLive,
}: {
  standings: StandingRow[]
  hasLive: boolean
}) {
  const cols = hasLive
    ? 'grid-cols-[34px_1fr_40px_50px_28px_22px]'
    : 'grid-cols-[34px_1fr_50px_28px_22px]'

  return (
    <div className="bg-card border border-border rounded-[12px] overflow-hidden">
      <div
        className={cn(
          'grid items-center px-[14px] py-[10px] border-b border-border text-[9px] font-extrabold uppercase tracking-[0.18em] text-muted-foreground',
          cols,
        )}
      >
        <span>{'#'}</span>
        <span>{'Player'}</span>
        {hasLive && <span className="text-center">{'Live'}</span>}
        <span className="text-right">{'Total'}</span>
        <span className="text-right">{'Ex'}</span>
        <span />
      </div>

      {standings.map((row) => (
        <StandingRowView key={row.profile.id} row={row} hasLive={hasLive} cols={cols} />
      ))}
    </div>
  )
}

function StandingRowView({
  row,
  hasLive,
  cols,
}: {
  row: StandingRow
  hasLive: boolean
  cols: string
}) {
  const isUser = row.isCurrentUser
  const total = hasLive ? row.totalPoints + row.matchdayPoints : row.totalPoints
  return (
    <div
      className={cn(
        'grid items-center py-[13px] pr-[14px] border-b border-border last:border-b-0 text-[14px]',
        cols,
        isUser
          ? 'bg-primary/10 border-l-[3px] border-l-primary pl-[11px]'
          : 'pl-[14px]',
      )}
    >
      <span
        className={cn(
          'font-display text-[22px] font-extrabold leading-none tracking-[-0.02em]',
          isUser
            ? 'text-primary'
            : row.position === 1
              ? 'text-primary'
              : row.position <= 3
                ? 'text-foreground'
                : 'text-dim',
        )}
      >
        {String(row.position).padStart(2, '0')}
      </span>
      <span
        className={cn(
          'inline-flex items-center gap-[8px] min-w-0 font-medium',
          isUser && 'text-foreground font-bold',
        )}
      >
        <Avatar profile={row.profile} size="md" />
        {row.position === 1 && (
          <Star className="size-[11px] fill-primary text-primary shrink-0" />
        )}
        <span className="truncate">{row.profile.displayName}</span>
        {row.boostersUsed > 0 && (
          <Zap className="size-[10px] text-primary opacity-55 shrink-0 fill-current" />
        )}
      </span>
      {hasLive && (
        <span
          className={cn(
            'font-mono font-bold text-center text-[12px]',
            row.matchdayPoints > 0 ? 'text-primary' : 'text-dim opacity-45',
          )}
        >
          {row.matchdayPoints > 0 ? `+${row.matchdayPoints}` : '·'}
        </span>
      )}
      <span
        className={cn(
          'font-display text-[22px] font-extrabold leading-none tracking-[-0.02em] text-right',
          isUser ? 'text-primary' : 'text-foreground',
        )}
      >
        {total}
      </span>
      <span className="font-mono text-right text-[11px] text-muted-foreground">
        {row.exactScores}
      </span>
      <span
        className={cn(
          'grid place-items-center text-[11px] font-extrabold font-mono',
          row.positionChange > 0
            ? 'text-success'
            : row.positionChange < 0
              ? 'text-destructive'
              : 'text-dim opacity-50',
        )}
      >
        {row.positionChange > 0 ? '▲' : row.positionChange < 0 ? '▼' : '·'}
      </span>
    </div>
  )
}
