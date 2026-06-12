'use client'

import { Fragment, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  ChevronDown,
  Settings,
  Share2,
  Star,
  UserPlus,
  Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePrediction } from '@/components/prediction-provider'
import { useLeagueDetail } from '@/hooks/use-league-detail'
import { useRealtimeMatch } from '@/hooks/use-realtime-match'
import { useLiveMinute } from '@/hooks/use-live-minute'
import { AnimatedScore } from '@/components/animated-score'
import { InviteFriendsModal } from '@/components/modals/invite-friends-modal'
import {
  Avatar,
  BOOSTER_PILL,
  BOOSTER_RAIL,
  BoosterPill,
  Crest,
  formatClock,
  formatCountdown,
  nth,
  teamName,
} from '@/components/match-ui'
import { formatDayLabel } from '@/lib/format'
import type {
  CompletedMatchSummary,
  LiveMatchSummary,
  Match,
  PredictionWithDetails,
  StandingRow,
  UpcomingMatchSummary,
  UUID,
} from '@/types'

// "Stadium Broadcast" (Direction E). Big Shoulders Display (`font-display`)
// on impact numerals + names; Geist for labels; Geist Mono for scores in
// lists, the live minute, and counts. Amber (`primary`) is the user's
// identity colour; `destructive` is reserved for live + urgency only.
// Shared crest / booster / format primitives live in `@/components/match-ui`.

const URGENT_KICKOFF_MIN = 120 // unpredicted + kicking off within 2h = urgent

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
      <span className="font-display text-[18px] font-extrabold uppercase tracking-[0.04em] text-foreground inline-flex items-center gap-2">
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

interface Props {
  leagueId: UUID
}

export function LeagueDetailScreen({ leagueId }: Props) {
  const router = useRouter()
  const { openPrediction } = usePrediction()
  const { data, isLoading } = useLeagueDetail(leagueId)
  const [tab, setTab] = useState<'upcoming' | 'played'>('upcoming')
  // Accordion for live cards: which match's picks are expanded. Only one
  // open at a time when several matches are live.
  const [openLiveId, setOpenLiveId] = useState<UUID | null>(null)
  const [inviteOpen, setInviteOpen] = useState(false)

  if (isLoading || !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-sm text-muted-foreground">{'Loading…'}</p>
      </div>
    )
  }

  const {
    league,
    isAdmin,
    standings,
    liveMatches,
    upcomingMatches,
    completedMatches,
  } = data
  const hasLive = liveMatches.length > 0
  const userStanding = standings.find((s) => s.isCurrentUser)
  const livePicks = liveMatches.reduce((a, m) => a + m.predictionCount, 0)

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
            <div className="font-display text-[22px] font-black uppercase leading-none tracking-[0.005em] text-foreground truncate">
              {league.name}
            </div>
            <div className="text-[10px] text-muted-foreground mt-[3px] tracking-[0.12em] uppercase font-semibold">
              {league.memberCount} {'players'}
            </div>
          </div>
          {hasLive ? (
            <span className="inline-flex items-center gap-[5px] bg-destructive text-foreground rounded-full px-[10px] py-[5px] text-[10px] font-extrabold tracking-[0.1em] shrink-0">
              <span className="size-[5px] rounded-full bg-current animate-pulse" />
              {liveMatches.length} {'LIVE'}
            </span>
          ) : (
            <span className="inline-flex items-center bg-secondary text-muted-foreground rounded-full px-[10px] py-[5px] text-[10px] font-bold tracking-[0.1em] uppercase border border-border shrink-0">
              {'No live'}
            </span>
          )}
          <button
            type="button"
            onClick={() => setInviteOpen(true)}
            aria-label="Invite friends"
            className="grid place-items-center size-[30px] rounded-[8px] text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors shrink-0"
          >
            <UserPlus className="size-4" />
          </button>
          {isAdmin && (
            <Link
              href={`/leagues/${leagueId}/settings`}
              aria-label="League settings"
              className="grid place-items-center size-[30px] rounded-[8px] text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors shrink-0"
            >
              <Settings className="size-4" />
            </Link>
          )}
        </div>
      </div>

      {/* ── Hero: rank + total ────────────────────────────────────────── */}
      {userStanding && (
        <div className="border-b border-border">
          <div className="max-w-2xl mx-auto relative overflow-hidden px-[18px] py-[22px]">
            <div className="pointer-events-none absolute -top-[120px] -right-[80px] size-[300px] rounded-full bg-[radial-gradient(circle,oklch(0.84_0.18_78_/_0.18),transparent_60%)]" />
            <div className="relative z-[1] grid grid-cols-[auto_1fr] items-end gap-[18px]">
              {/* Rank */}
              <div className="flex flex-col gap-[2px]">
                <span className="text-[9px] font-extrabold uppercase tracking-[0.22em] text-muted-foreground">
                  {'Rank'}
                </span>
                <span className="font-display flex items-baseline gap-1 text-primary">
                  <span className="text-[36px] font-bold leading-none opacity-50">
                    {'#'}
                  </span>
                  <span className="text-[84px] font-extrabold leading-[0.82]">
                    {String(userStanding.position).padStart(2, '0')}
                  </span>
                </span>
                <span className="text-[11px] text-muted-foreground tracking-[0.1em] font-semibold">
                  {'of'} {league.memberCount}
                </span>
              </div>
              {/* Total */}
              <div className="flex flex-col gap-1 text-right border-l border-border pl-[14px] ml-auto self-stretch justify-end">
                <span className="text-[9px] font-extrabold uppercase tracking-[0.22em] text-muted-foreground">
                  {'Total'}
                </span>
                <span className="font-display text-[44px] font-extrabold leading-[0.88] tracking-[-0.04em] text-foreground">
                  {userStanding.totalPoints + userStanding.matchdayPoints}
                </span>
                <span className="text-[11px] text-muted-foreground font-semibold tracking-[0.05em]">
                  {'points'}
                </span>
                {hasLive && userStanding.matchdayPoints > 0 && (
                  <span className="self-end inline-flex items-center gap-1 bg-primary/10 text-primary rounded-full px-2 py-[3px] text-[11px] font-extrabold font-mono mt-[2px]">
                    {'▲ +'}
                    {userStanding.matchdayPoints} {'live'}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-2xl mx-auto px-4">
        {/* ── Solo invite CTA — only when the user is alone in the league ── */}
        {standings.length === 1 && (
          <SoloInviteCard
            inviteCode={league.inviteCode}
            onShare={() => setInviteOpen(true)}
          />
        )}

        {/* ── Live scoreboard(s) ──────────────────────────────────────── */}
        {hasLive && (
          <section className="pt-[22px]">
            <SectionHead title="Live" meta={`${livePicks} picks`} live />
            <div className="space-y-3">
              {liveMatches.map((m) => {
                const collapsible = liveMatches.length > 1
                return (
                  <LiveScoreboard
                    key={m.match.id}
                    summary={m}
                    leagueId={leagueId}
                    collapsible={collapsible}
                    expanded={!collapsible || openLiveId === m.match.id}
                    onToggle={() =>
                      setOpenLiveId((cur) =>
                        cur === m.match.id ? null : m.match.id,
                      )
                    }
                  />
                )
              })}
            </div>
          </section>
        )}

        {/* ── Standings ───────────────────────────────────────────────── */}
        <section className="pt-[22px]">
          <SectionHead title="Standings" meta={`${standings.length} players`} />
          <StandingsTable standings={standings} hasLive={hasLive} />
        </section>

        {/* ── Tabs: Upcoming / Played ─────────────────────────────────── */}
        <div className="pt-[26px]">
          <div className="grid grid-cols-2 bg-card border border-border rounded-[10px] p-1">
            <TabButton
              active={tab === 'upcoming'}
              count={upcomingMatches.length}
              onClick={() => setTab('upcoming')}
            >
              {'Upcoming'}
            </TabButton>
            <TabButton
              active={tab === 'played'}
              count={completedMatches.length}
              onClick={() => setTab('played')}
            >
              {'Played'}
            </TabButton>
          </div>

          <div className="pt-1">
            {tab === 'upcoming' ? (
              <UpcomingTab
                upcoming={upcomingMatches}
                onPredict={openPrediction}
              />
            ) : (
              <PlayedTab completed={completedMatches} leagueId={leagueId} />
            )}
          </div>
        </div>
      </div>

      <InviteFriendsModal
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        leagueName={league.name}
        inviteCode={league.inviteCode}
      />
    </div>
  )
}

// ── Solo invite CTA (inline, under the hero) ─────────────────────────────────
function SoloInviteCard({
  inviteCode,
  onShare,
}: {
  inviteCode: string
  onShare: () => void
}) {
  return (
    <div className="mt-[22px] rounded-[14px] border border-primary/30 bg-primary/[0.06] p-5">
      <div className="flex items-start gap-3">
        <div className="text-2xl leading-none mt-0.5">{'👋'}</div>
        <div className="flex-1 min-w-0">
          <h3 className="font-display text-[18px] font-extrabold uppercase leading-none tracking-[0.005em] text-foreground">
            {'You’re flying solo'}
          </h3>
          <p className="mt-1.5 text-[12px] text-muted-foreground leading-relaxed">
            {'Invite friends to make it a competition. They can join with this code:'}
          </p>
          <div className="mt-3 inline-flex items-center gap-2 rounded-[8px] border border-border bg-card px-3 py-1.5 font-mono text-[14px] font-extrabold tracking-[0.2em] text-foreground">
            {inviteCode}
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={onShare}
        className="mt-4 w-full bg-primary text-primary-foreground rounded-[8px] py-3 font-display text-[14px] font-black uppercase tracking-[0.08em] inline-flex items-center justify-center gap-2 hover:opacity-95 transition-opacity"
      >
        <Share2 className="size-4" />
        {'Share invite'}
      </button>
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

// ── Live scoreboard card ─────────────────────────────────────────────────────

const LIVE_PICKS_PREVIEW = 5

function LiveScoreboard({
  summary,
  leagueId,
  expanded,
  collapsible,
  onToggle,
}: {
  summary: LiveMatchSummary
  leagueId: UUID
  expanded: boolean
  collapsible: boolean
  onToggle: () => void
}) {
  const { match, userPrediction, predictionCount, rankedPredictions } = summary
  useRealtimeMatch(match.id, leagueId)
  const liveMinute = useLiveMinute(
    match.liveMinute,
    match.status,
    match.kickoffTime,
  )
  const booster = userPrediction?.booster ?? null
  const userPts = userPrediction?.points?.total ?? 0
  const [showAll, setShowAll] = useState(false)
  const matchHref = `/matches/${match.id}?league=${leagueId}`

  const leader = rankedPredictions[0] ?? null
  const youIdx = userPrediction
    ? rankedPredictions.findIndex((p) => p.id === userPrediction.id)
    : -1

  return (
    <div className="rounded-[14px] overflow-hidden border border-destructive/15 bg-gradient-to-b from-[oklch(0.10_0.005_30)] to-card">
      {/* Everything above the picks section links to the full match page
          (all predictions + live standings). */}
      <Link
        href={matchHref}
        aria-label={`${teamName(match.homeTeam)} vs ${teamName(match.awayTeam)} — match details`}
        className="block transition-colors hover:bg-white/[0.02]"
      >
      {/* top strip */}
      <div className="flex justify-between items-center px-[14px] py-[9px] border-b border-border bg-[oklch(0.115_0.005_30)]">
        <span className="text-[10px] text-muted-foreground tracking-[0.16em] uppercase font-bold">
          {match.round.name}
        </span>
        <span className="text-destructive font-extrabold inline-flex items-center gap-[6px] font-mono text-[11px] tracking-[0.06em]">
          <span className="size-[5px] rounded-full bg-destructive animate-pulse" />
          {liveMinute ?? 'LIVE'}
        </span>
      </div>

      {/* scoreboard */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-[14px] px-[14px] py-[18px]">
        <div className="flex flex-col items-center gap-[10px] min-w-0">
          <Crest team={match.homeTeam} size="lg" />
          <span className="font-display text-[18px] font-extrabold uppercase tracking-[0.01em] leading-none text-center">
            {teamName(match.homeTeam)}
          </span>
        </div>
        <div className="flex items-center gap-1 leading-none text-foreground">
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
        </div>
        <div className="flex flex-col items-center gap-[10px] min-w-0">
          <Crest team={match.awayTeam} size="lg" />
          <span className="font-display text-[18px] font-extrabold uppercase tracking-[0.01em] leading-none text-center">
            {teamName(match.awayTeam)}
          </span>
        </div>
      </div>

      {/* your pick */}
      {userPrediction && (
        <div className="grid grid-cols-[auto_1fr_auto] gap-[14px] items-center px-[14px] py-[11px] border-t border-dashed border-hair-strong bg-[oklch(0.105_0.003_60)]">
          <span className="text-[9px] font-extrabold uppercase tracking-[0.22em] text-muted-foreground">
            {'Your pick'}
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="font-display text-[26px] font-extrabold leading-[0.9] tracking-[-0.02em]">
              {userPrediction.homeScore}
              {'–'}
              {userPrediction.awayScore}
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
      )}
      </Link>

      {/* picks — collapsed summary (accordion) or expanded ranked list */}
      {collapsible && !expanded ? (
        <button
          type="button"
          onClick={onToggle}
          className="w-full flex justify-between items-center gap-3 px-[14px] py-[11px] border-t border-border text-left hover:bg-secondary/30 transition-colors"
        >
          <span className="text-[12px] truncate">
            {leader && (
              <>
                <span className="text-muted-foreground">{'Leader '}</span>
                <span className="font-semibold text-foreground">
                  {leader.profile.displayName}
                </span>{' '}
                <span className="font-mono font-bold text-primary">
                  {(leader.points?.total ?? 0) > 0
                    ? `+${leader.points?.total}`
                    : '0'}
                </span>
                <span className="text-dim">{'  ·  '}</span>
              </>
            )}
            <span className="text-muted-foreground">{'You '}</span>
            {youIdx >= 0 ? (
              <>
                <span className="font-semibold text-foreground">
                  {youIdx + 1}
                  {nth(youIdx + 1)}
                </span>{' '}
                <span className="font-mono font-bold text-primary">
                  {userPts > 0 ? `+${userPts}` : '·'}
                </span>
              </>
            ) : (
              <span className="text-dim">{'no pick'}</span>
            )}
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground shrink-0">
            {'Picks'}
            <ChevronDown className="size-4" />
          </span>
        </button>
      ) : (
        <LivePicks
          ranked={rankedPredictions}
          youId={userPrediction?.id ?? null}
          youIdx={youIdx}
          showAll={showAll}
          onToggleShowAll={() => setShowAll((v) => !v)}
          collapsible={collapsible}
          onCollapse={onToggle}
          matchHref={`/matches/${match.id}?league=${leagueId}`}
          predictionCount={predictionCount}
        />
      )}
    </div>
  )
}

function LivePicks({
  ranked,
  youId,
  youIdx,
  showAll,
  onToggleShowAll,
  collapsible,
  onCollapse,
  matchHref,
  predictionCount,
}: {
  ranked: PredictionWithDetails[]
  youId: string | null
  youIdx: number
  showAll: boolean
  onToggleShowAll: () => void
  collapsible: boolean
  onCollapse: () => void
  matchHref: string
  predictionCount: number
}) {
  const visible = showAll ? ranked : ranked.slice(0, LIVE_PICKS_PREVIEW)
  const hasMore = ranked.length > LIVE_PICKS_PREVIEW
  // Pin the user's row when they're outside the previewed top N.
  const pinYou = !showAll && youIdx >= LIVE_PICKS_PREVIEW

  return (
    <div className="border-t border-border">
      <div className="flex items-center justify-between px-[14px] py-[11px]">
        <span className="text-[9px] font-extrabold uppercase tracking-[0.18em] text-muted-foreground">
          {'Picks · by points'}
        </span>
        {collapsible && (
          <button
            type="button"
            onClick={onCollapse}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            {'Hide'}
            <ChevronDown className="size-4 rotate-180" />
          </button>
        )}
      </div>

      <div className="px-[14px] pb-1">
        {visible.map((p, i) => (
          <LivePickRow key={p.id} p={p} rank={i + 1} isYou={p.id === youId} />
        ))}
        {pinYou && ranked[youIdx] && (
          <>
            <div className="text-center text-dim text-[11px] leading-none py-1">
              {'·····'}
            </div>
            <LivePickRow p={ranked[youIdx]} rank={youIdx + 1} isYou />
          </>
        )}
      </div>

      <div className="flex items-center justify-between px-[14px] py-[9px] border-t border-border text-[11px] text-muted-foreground">
        {hasMore ? (
          <button
            type="button"
            onClick={onToggleShowAll}
            className="font-semibold text-foreground hover:text-primary transition-colors"
          >
            {showAll ? 'Show top 5' : `Show all ${predictionCount}`}
          </button>
        ) : (
          <span>
            {predictionCount} {'picks'}
          </span>
        )}
        <Link href={matchHref} className="text-foreground font-semibold hover:underline">
          {'Match details →'}
        </Link>
      </div>
    </div>
  )
}

function LivePickRow({
  p,
  rank,
  isYou,
}: {
  p: PredictionWithDetails
  rank: number
  isYou: boolean
}) {
  const pts = p.points?.total ?? 0
  const exact = p.points?.base === 4
  const ptsColor = exact
    ? 'text-primary'
    : pts > 0
      ? 'text-foreground'
      : 'text-dim'
  return (
    <div
      className={cn(
        'flex items-center gap-2 py-[7px]',
        isYou && 'bg-primary/10 border-l-[3px] border-l-primary -mx-[14px] pl-[11px] pr-[14px]',
      )}
    >
      <span className="w-[18px] text-center font-mono text-[11px] text-dim">
        {rank}
      </span>
      <Avatar profile={p.profile} size="sm" />
      <span
        className={cn(
          'flex-1 truncate text-[13px]',
          isYou ? 'text-foreground font-bold' : 'font-medium',
        )}
      >
        {p.profile.displayName}
      </span>
      <span className="font-mono text-[12px] text-muted-foreground tabular-nums">
        {p.homeScore}
        {'–'}
        {p.awayScore}
      </span>
      {p.booster && (
        <span
          className={cn(
            'inline-flex items-center gap-0.5 rounded-[4px] px-1 py-px text-[10px] font-black leading-none',
            BOOSTER_PILL[p.booster],
          )}
        >
          <Zap className="size-[9px] fill-current" />
          {'×'}
          {p.booster.slice(1)}
        </span>
      )}
      <span
        className={cn(
          'w-[40px] text-right font-display text-[18px] font-extrabold tracking-[-0.02em] tabular-nums',
          ptsColor,
        )}
      >
        {pts > 0 ? `+${pts}` : '·'}
      </span>
    </div>
  )
}

// ── Standings ────────────────────────────────────────────────────────────────

// Above this many players the table condenses to: top 3 + a gap + the
// user's own row with one neighbour either side + "Show all". Smaller
// leagues render in full. Expanding shows everyone inline (page scroll,
// no inner scrollbar).
const STANDINGS_FULL_LIMIT = 12

// Build the rows to display. When condensed, returns the top 3 plus the
// user's window (you ±1), de-duped and ordered, with a `gapBefore` flag
// wherever the visible positions skip.
function buildStandingsView(
  standings: StandingRow[],
  condense: boolean,
): { row: StandingRow; gapBefore: boolean }[] {
  if (!condense) return standings.map((row) => ({ row, gapBefore: false }))

  const n = standings.length
  const show = new Set<number>()
  for (let i = 0; i < Math.min(3, n); i++) show.add(i)
  const userIdx = standings.findIndex((r) => r.isCurrentUser)
  if (userIdx >= 0) {
    for (const j of [userIdx - 1, userIdx, userIdx + 1]) {
      if (j >= 0 && j < n) show.add(j)
    }
  } else {
    // No "you" row (rare) — just show a few more from the top.
    for (let i = 3; i < Math.min(6, n); i++) show.add(i)
  }

  const ordered = Array.from(show).sort((a, b) => a - b)
  let prev = -1
  return ordered.map((idx) => {
    const item = { row: standings[idx], gapBefore: prev !== -1 && idx - prev > 1 }
    prev = idx
    return item
  })
}

function StandingsTable({
  standings,
  hasLive,
}: {
  standings: StandingRow[]
  hasLive: boolean
}) {
  const [showAll, setShowAll] = useState(false)
  const cols = hasLive
    ? 'grid-cols-[34px_1fr_40px_50px_28px_22px]'
    : 'grid-cols-[34px_1fr_50px_28px_22px]'

  const collapsible = standings.length > STANDINGS_FULL_LIMIT
  const items = buildStandingsView(standings, collapsible && !showAll)

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

      {items.map(({ row, gapBefore }) => (
        <Fragment key={row.profile.id}>
          {gapBefore && (
            <div className="px-[14px] py-1 text-center text-dim text-[13px] leading-none tracking-[0.3em] border-b border-border select-none">
              {'···'}
            </div>
          )}
          <StandingRowView row={row} hasLive={hasLive} cols={cols} />
        </Fragment>
      ))}

      {collapsible && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="w-full py-2.5 text-xs font-semibold text-foreground hover:text-primary transition-colors"
        >
          {showAll ? 'Show less' : `Show all ${standings.length} players`}
        </button>
      )}
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

// ── Upcoming tab ─────────────────────────────────────────────────────────────

type DayBucket = { key: string; date: Date; matches: UpcomingMatchSummary[] }

function bucketByDay(matches: UpcomingMatchSummary[]): DayBucket[] {
  const buckets = new Map<string, DayBucket>()
  for (const m of matches) {
    const d = new Date(m.match.kickoffTime)
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
    let bucket = buckets.get(key)
    if (!bucket) {
      const startOfDay = new Date(d)
      startOfDay.setHours(0, 0, 0, 0)
      bucket = { key, date: startOfDay, matches: [] }
      buckets.set(key, bucket)
    }
    bucket.matches.push(m)
  }
  return Array.from(buckets.values()).sort(
    (a, b) => a.date.getTime() - b.date.getTime(),
  )
}

function DayStrip({
  label,
  count,
  today = false,
}: {
  label: string
  count: number
  today?: boolean
}) {
  return (
    <div className="flex items-center gap-3 mt-[22px] mb-3 first:mt-3">
      <span
        className={cn(
          'font-display text-[14px] font-black uppercase tracking-[0.06em] rounded-full px-[11px] py-[3px] border',
          today
            ? 'bg-primary text-background border-primary'
            : 'bg-card text-foreground border-border',
        )}
      >
        {label}
      </span>
      <span className="flex-1 h-px bg-border" />
      <span className="font-mono text-[10px] uppercase tracking-[0.12em] font-bold text-dim">
        {count} {count === 1 ? 'match' : 'matches'}
      </span>
    </div>
  )
}

// Show the next 2 non-empty days by default; "Load more" appends the next
// non-empty day (label + match count on the button), and collapses back.
const DAYS_INITIAL = 2

function UpcomingTab({
  upcoming,
  onPredict,
}: {
  upcoming: UpcomingMatchSummary[]
  onPredict: (matchId: UUID) => void
}) {
  const days = useMemo(() => bucketByDay(upcoming), [upcoming])
  const [daysShown, setDaysShown] = useState(DAYS_INITIAL)

  if (upcoming.length === 0) {
    return (
      <div className="mt-3 rounded-[12px] border border-border bg-card px-5 py-8 text-center">
        <p className="text-sm font-semibold text-foreground">
          {'No upcoming fixtures'}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {'Check back when the next round is scheduled.'}
        </p>
      </div>
    )
  }

  const visibleDays = days.slice(0, daysShown)
  const nextDay = days[daysShown]
  const remainingDays = days.length - visibleDays.length

  return (
    <div>
      {visibleDays.map((day) => {
        const label = formatDayLabel(day.date)
        const sorted = [...day.matches].sort((a, b) =>
          a.match.kickoffTime.localeCompare(b.match.kickoffTime),
        )
        return (
          <div key={day.key}>
            <DayStrip
              label={label}
              count={day.matches.length}
              today={label === 'TODAY'}
            />
            {sorted.map((m) => (
              <UpcomingCard
                key={m.match.id}
                summary={m}
                onPredict={() => onPredict(m.match.id)}
              />
            ))}
          </div>
        )
      })}

      {remainingDays > 0 && nextDay && (
        <button
          type="button"
          onClick={() => setDaysShown((d) => d + 1)}
          className="w-full mt-3 py-2 text-xs font-semibold text-foreground hover:text-primary transition-colors"
        >
          {`Load ${formatDayLabel(nextDay.date)} `}
          <span className="text-muted-foreground">
            ({nextDay.matches.length}{' '}
            {nextDay.matches.length === 1 ? 'match' : 'matches'})
          </span>
        </button>
      )}

      {daysShown > DAYS_INITIAL && (
        <button
          type="button"
          onClick={() => setDaysShown(DAYS_INITIAL)}
          className="w-full mt-1 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          {'Collapse'}
        </button>
      )}
    </div>
  )
}

function UpcomingCard({
  summary,
  onPredict,
}: {
  summary: UpcomingMatchSummary
  onPredict: () => void
}) {
  const { match, userPrediction } = summary
  const locked = userPrediction !== null
  const booster = userPrediction?.booster ?? null

  const [now] = useState(() => Date.now())
  const minsToKickoff = Math.floor(
    (new Date(match.kickoffTime).getTime() - now) / 60_000,
  )
  const urgent = !locked && minsToKickoff > 0 && minsToKickoff < URGENT_KICKOFF_MIN

  // Left rail signals booster type (x2 green / x3 sky / x5 amber). A
  // predicted-without-booster card gets a muted neutral rail so it still
  // reads as "locked in" without colliding with the x5 amber.
  const rail = !locked
    ? 'bg-transparent'
    : booster
      ? BOOSTER_RAIL[booster]
      : 'bg-dim'

  return (
    <button
      type="button"
      onClick={onPredict}
      aria-label={
        locked
          ? `Edit your prediction for ${teamName(match.homeTeam)} vs ${teamName(match.awayTeam)}`
          : `Predict ${teamName(match.homeTeam)} vs ${teamName(match.awayTeam)}`
      }
      className="relative block w-full text-left overflow-hidden rounded-[12px] border border-border bg-card mb-[10px] hover:border-hair-strong transition-colors"
    >
      <span className={cn('absolute left-0 top-0 bottom-0 w-[3px]', rail)} />

      {/* top: round + kickoff (with optional urgency pill) */}
      <div className="flex justify-between items-center pt-[11px] pr-[14px] pl-4">
        <span className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-muted-foreground">
          {match.round.name}
        </span>
        <span className="inline-flex items-center">
          {urgent && (
            <span className="inline-flex items-center gap-[5px] mr-2 rounded-full bg-destructive/[0.13] text-destructive px-2 py-[3px] font-mono text-[11px] font-extrabold tracking-[0.04em] leading-none">
              <span className="size-[5px] rounded-full bg-destructive animate-pulse shrink-0" />
              {formatCountdown(minsToKickoff)} {'left'}
            </span>
          )}
          <span className="inline-flex items-baseline gap-1 font-display text-[18px] font-extrabold leading-none tracking-[-0.01em] text-foreground">
            <span className="font-sans text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground mr-0.5">
              {'Kickoff'}
            </span>
            {formatClock(match.kickoffTime)}
          </span>
        </span>
      </div>

      {/* teams */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-[10px] pt-3 pb-[14px] pr-[14px] pl-4">
        <div className="flex items-center gap-[9px] min-w-0">
          <Crest team={match.homeTeam} size="sm" />
          <span className="font-display text-[19px] font-extrabold uppercase tracking-[0.01em] leading-none truncate">
            {teamName(match.homeTeam)}
          </span>
        </div>
        <span className="font-display text-[13px] font-extrabold uppercase tracking-[0.14em] text-dim">
          {'VS'}
        </span>
        <div className="flex flex-row-reverse items-center gap-[9px] min-w-0">
          <Crest team={match.awayTeam} size="sm" />
          <span className="font-display text-[19px] font-extrabold uppercase tracking-[0.01em] leading-none truncate">
            {teamName(match.awayTeam)}
          </span>
        </div>
      </div>

      {/* foot: locked (pick + edit) or open (predict CTA) */}
      {locked && userPrediction ? (
        <div className="grid grid-cols-[1fr_auto] gap-3 items-center pt-[11px] pb-3 pr-[14px] pl-4 border-t border-border bg-[oklch(0.11_0.003_60)]">
          <div className="flex flex-col gap-[3px] min-w-0">
            <span className="text-[9px] font-extrabold uppercase tracking-[0.2em] text-muted-foreground">
              {'Your pick'}
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="font-display text-[28px] font-black leading-[0.9] tracking-[-0.03em] text-foreground">
                {userPrediction.homeScore}
                {'–'}
                {userPrediction.awayScore}
              </span>
              {booster && <BoosterPill booster={booster} />}
            </span>
          </div>
          <span className="bg-secondary text-foreground rounded-[8px] px-[14px] py-[9px] font-bold text-[12px] uppercase tracking-[0.04em]">
            {'Edit'}
          </span>
        </div>
      ) : (
        <div className="pt-[11px] pb-3 pr-[14px] pl-4 border-t border-border bg-[oklch(0.11_0.003_60)]">
          <span className="w-full bg-primary text-primary-foreground rounded-[8px] py-3 font-display text-[16px] font-black uppercase tracking-[0.08em] flex items-center justify-center gap-2">
            {'Predict'}
            <span className="text-[18px] leading-none">{'→'}</span>
          </span>
        </div>
      )}
    </button>
  )
}

// ── Played tab ───────────────────────────────────────────────────────────────

// Played list is a flat feed of finished matches, most-recent first,
// paginated by match count. Round names are kept as section headers
// (inserted whenever the round changes within the visible slice).
const PLAYED_INITIAL = 5
const PLAYED_STEP = 5

function PlayedTab({
  completed,
  leagueId,
}: {
  completed: CompletedMatchSummary[]
  leagueId: UUID
}) {
  const sorted = useMemo(
    () =>
      [...completed].sort((a, b) =>
        b.match.kickoffTime.localeCompare(a.match.kickoffTime),
      ),
    [completed],
  )
  const [visibleCount, setVisibleCount] = useState(PLAYED_INITIAL)

  if (completed.length === 0) {
    return (
      <div className="mt-3 rounded-[12px] border border-border bg-card px-5 py-8 text-center">
        <p className="text-sm font-semibold text-foreground">
          {'No results yet'}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {'Played matches will show up here once they finish.'}
        </p>
      </div>
    )
  }

  const visible = sorted.slice(0, visibleCount)
  const remaining = sorted.length - visible.length

  // Bucket the visible slice into contiguous round groups for the pills.
  const groups: { roundId: UUID; name: string; matches: CompletedMatchSummary[] }[] = []
  for (const m of visible) {
    const last = groups[groups.length - 1]
    if (last && last.roundId === m.match.round.id) {
      last.matches.push(m)
    } else {
      groups.push({
        roundId: m.match.round.id,
        name: m.match.round.name,
        matches: [m],
      })
    }
  }

  return (
    <div>
      {groups.map((g, i) => (
        <div key={`${g.roundId}-${i}`}>
          <DayStrip label={g.name} count={g.matches.length} />
          {g.matches.map((m) => (
            <PlayedCard key={m.match.id} summary={m} leagueId={leagueId} />
          ))}
        </div>
      ))}

      {remaining > 0 && (
        <button
          type="button"
          onClick={() => setVisibleCount((c) => c + PLAYED_STEP)}
          className="w-full mt-3 py-2 text-xs font-semibold text-foreground hover:text-primary transition-colors"
        >
          {`Load ${Math.min(PLAYED_STEP, remaining)} more `}
          <span className="text-muted-foreground">({remaining} {'left'})</span>
        </button>
      )}

      {visibleCount > PLAYED_INITIAL && (
        <button
          type="button"
          onClick={() => setVisibleCount(PLAYED_INITIAL)}
          className="w-full mt-1 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          {'Collapse'}
        </button>
      )}
    </div>
  )
}

function resultStatus(
  match: Match,
  pred: CompletedMatchSummary['userPrediction'],
): 'exact' | 'outcome' | 'wrong' | null {
  if (!pred) return null
  const hs = match.homeScore ?? 0
  const as = match.awayScore ?? 0
  if (pred.homeScore === hs && pred.awayScore === as) return 'exact'
  if (Math.sign(pred.homeScore - pred.awayScore) === Math.sign(hs - as))
    return 'outcome'
  return 'wrong'
}

const PLAYED_RAIL = {
  exact: 'bg-primary',
  outcome: 'bg-foreground/35',
  wrong: 'bg-destructive/50',
  none: 'bg-transparent',
} as const

const PLAYED_TAG = {
  exact: 'bg-primary text-background',
  outcome: 'bg-secondary text-foreground',
  wrong: 'bg-transparent border border-destructive text-destructive',
} as const

function PlayedCard({
  summary,
  leagueId,
}: {
  summary: CompletedMatchSummary
  leagueId: UUID
}) {
  const { match, userPrediction } = summary
  const hs = match.homeScore ?? 0
  const as = match.awayScore ?? 0
  const status = resultStatus(match, userPrediction)
  const total = userPrediction?.points?.total ?? 0
  const homeLost = hs < as
  const awayLost = as < hs

  const tagLabel =
    status === 'exact'
      ? 'Eksakt'
      : status === 'outcome'
        ? 'Outcome'
        : status === 'wrong'
          ? 'Missed'
          : 'No pick'

  return (
    <Link
      href={`/matches/${match.id}?league=${leagueId}`}
      className="relative block overflow-hidden rounded-[12px] border border-border bg-card mb-[10px] hover:border-hair-strong transition-colors"
    >
      <span
        className={cn(
          'absolute left-0 top-0 bottom-0 w-[3px]',
          PLAYED_RAIL[status ?? 'none'],
        )}
      />

      <div className="flex justify-between items-center pt-[11px] pr-[14px] pl-4">
        <span className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-muted-foreground">
          {match.round.name} {'· Final'}
        </span>
        <span
          className={cn(
            'font-display text-[13px] font-black uppercase tracking-[0.1em] leading-none rounded-[4px] px-[9px] py-[3px]',
            status ? PLAYED_TAG[status] : 'bg-secondary text-muted-foreground',
          )}
        >
          {tagLabel}
        </span>
      </div>

      <div className="grid grid-cols-[1fr_1px_auto] gap-[14px] items-center pt-3 pb-[14px] pr-[14px] pl-4">
        <div className="flex flex-col gap-1 min-w-0">
          <div
            className={cn(
              'flex items-center justify-between gap-[10px]',
              homeLost && 'opacity-45',
            )}
          >
            <span className="flex items-center gap-2 min-w-0 font-display text-[17px] font-bold uppercase tracking-[0.005em]">
              <Crest team={match.homeTeam} size="xs" />
              <span className="truncate">{teamName(match.homeTeam)}</span>
            </span>
            <span className="font-display text-[22px] font-extrabold tracking-[-0.03em] leading-none">
              {hs}
            </span>
          </div>
          <div
            className={cn(
              'flex items-center justify-between gap-[10px]',
              awayLost && 'opacity-45',
            )}
          >
            <span className="flex items-center gap-2 min-w-0 font-display text-[17px] font-bold uppercase tracking-[0.005em]">
              <Crest team={match.awayTeam} size="xs" />
              <span className="truncate">{teamName(match.awayTeam)}</span>
            </span>
            <span className="font-display text-[22px] font-extrabold tracking-[-0.03em] leading-none">
              {as}
            </span>
          </div>
        </div>

        <span className="bg-border h-[48px] w-px" />

        <div className="flex flex-col items-end gap-[2px] min-w-[70px]">
          <span className="text-[9px] font-extrabold uppercase tracking-[0.2em] text-muted-foreground">
            {'You'}
          </span>
          {userPrediction ? (
            <>
              <span className="font-mono text-[11px] font-bold text-muted-foreground">
                {userPrediction.homeScore}
                {'–'}
                {userPrediction.awayScore}
              </span>
              <span
                className={cn(
                  'font-display text-[34px] font-black leading-[0.85] tracking-[-0.04em] mt-0.5',
                  total >= 5
                    ? 'text-primary'
                    : total >= 1
                      ? 'text-foreground'
                      : 'text-dim',
                )}
              >
                {total > 0 ? `+${total}` : '0'}
              </span>
            </>
          ) : (
            <span className="font-display text-[34px] font-black text-dim leading-[0.85] mt-0.5">
              {'—'}
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}
