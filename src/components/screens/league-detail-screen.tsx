'use client'

import { useMemo, useState } from 'react'
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
  Settings,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePrediction } from '@/components/prediction-provider'
import { useCurrentUser } from '@/hooks/use-current-user'
import { useLeagueDetail } from '@/hooks/use-league-detail'
import { useMatch } from '@/hooks/use-match'
import {
  displayLiveMinute,
  formatDayLabel,
  formatKickoff,
  pointsTier,
} from '@/lib/format'
import type {
  CompletedMatchSummary,
  League,
  LiveMatchSummary,
  Match,
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
            {isAdmin && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 flex-shrink-0"
                asChild
              >
                <Link href={`/leagues/${leagueId}/settings`} aria-label="League settings">
                  <Settings className="h-4 w-4" />
                </Link>
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-6">
        {hasLive && (
          <LiveMatchesSection
            liveMatches={liveMatches}
            league={league}
            leagueId={leagueId}
            expandedMatchId={expandedMatchId}
            onToggle={(id) =>
              setExpandedMatchId(expandedMatchId === id ? null : id)
            }
          />
        )}

        <section className="space-y-3">
          <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            {hasLive ? 'Live Standings' : 'Standings'}
          </h2>
          <StandingsTable standings={standings} hasLive={hasLive} />
        </section>

        <UpcomingSection
          upcoming={upcomingMatches}
          league={league}
          unpredictedCount={unpredictedCount}
          onPredict={openPrediction}
        />

        {completedMatches.length > 0 && (
          <RecentResultsSection
            completed={completedMatches}
            leagueId={leagueId}
          />
        )}
      </div>
    </div>
  )
}

// ── Live matches: grouped by competition (single-comp leagues skip header) ─

function LiveMatchesSection({
  liveMatches,
  league,
  leagueId,
  expandedMatchId,
  onToggle,
}: {
  liveMatches: LiveMatchSummary[]
  league: League
  leagueId: UUID
  expandedMatchId: UUID | null
  onToggle: (matchId: UUID) => void
}) {
  const compNameById = useMemo(() => {
    const m = new Map<UUID, string>()
    for (const lc of league.competitions) {
      m.set(lc.competition.id, lc.competition.name)
    }
    return m
  }, [league.competitions])
  const showCompHeader = league.competitions.length > 1

  const compBuckets = useMemo(
    () => bucketByCompetition(liveMatches, compNameById),
    [liveMatches, compNameById],
  )

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Circle className="h-2 w-2 fill-destructive text-destructive animate-pulse" />
        <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
          {'Live Matches'}
        </h2>
      </div>

      <div className="space-y-3">
        {compBuckets.map((comp) => (
          <div key={comp.competitionId} className="space-y-2">
            {showCompHeader && (
              <h4 className="text-[11px] font-medium text-muted-foreground tracking-wide px-1">
                {comp.name}
              </h4>
            )}
            <div className="space-y-3">
              {comp.matches.map((m) => (
                <LiveMatchCard
                  key={m.match.id}
                  summary={m}
                  leagueId={leagueId}
                  expanded={expandedMatchId === m.match.id}
                  onToggle={() => onToggle(m.match.id)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

// ── Upcoming: day buckets > competition groups > matches ────────────────────
//
// Layout: outer sticky labels are days ("TODAY" / "TOMORROW" / "WED 14 MAY").
// Inside each day, matches are sub-grouped by competition (only when the
// league tracks multiple comps — single-comp leagues skip the sub-header).
// Matches inside a competition group are sorted by kickoff time.
//
// Default: show the next 2 non-empty days. "Load more" appends the next
// non-empty day, with the button label telling you exactly what's about
// to appear and how many matches are in it. Empty days (international
// breaks, etc.) are skipped automatically.

const DAYS_INITIAL = 2

type DayBucket = {
  key: string
  date: Date
  matches: UpcomingMatchSummary[]
}

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

// Generic over the match-summary kind (live / upcoming / completed) so
// both LiveMatchesSection and UpcomingSection can call it.
function bucketByCompetition<T extends { match: Match }>(
  matches: T[],
  compNameById: Map<UUID, string>,
): Array<{ competitionId: UUID; name: string; matches: T[] }> {
  const buckets = new Map<
    UUID,
    { competitionId: UUID; name: string; matches: T[] }
  >()
  for (const m of matches) {
    const cid = m.match.competitionId
    let bucket = buckets.get(cid)
    if (!bucket) {
      bucket = {
        competitionId: cid,
        name: compNameById.get(cid) ?? '—',
        matches: [],
      }
      buckets.set(cid, bucket)
    }
    bucket.matches.push(m)
  }
  // Order comp groups by their earliest kickoff so the user sees the
  // next thing happening first.
  return Array.from(buckets.values()).sort((a, b) =>
    a.matches[0].match.kickoffTime.localeCompare(b.matches[0].match.kickoffTime),
  )
}

function UpcomingSection({
  upcoming,
  league,
  unpredictedCount,
  onPredict,
}: {
  upcoming: UpcomingMatchSummary[]
  league: League
  unpredictedCount: number
  onPredict: (matchId: UUID) => void
}) {
  const compNameById = useMemo(() => {
    const m = new Map<UUID, string>()
    for (const lc of league.competitions) {
      m.set(lc.competition.id, lc.competition.name)
    }
    return m
  }, [league.competitions])
  const showCompHeader = league.competitions.length > 1

  const days = useMemo(() => bucketByDay(upcoming), [upcoming])
  const [daysShown, setDaysShown] = useState(DAYS_INITIAL)
  const visibleDays = days.slice(0, daysShown)
  const nextDay = days[daysShown]
  const remainingDays = days.length - visibleDays.length

  if (upcoming.length === 0) {
    return (
      <Card className="bg-card border-border overflow-hidden">
        <div className="p-5 text-center">
          <div className="h-12 w-12 rounded-full bg-secondary flex items-center justify-center mx-auto mb-3">
            <CalendarClock className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-semibold text-foreground">
            {'No upcoming fixtures'}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {'Check back when the next round is scheduled.'}
          </p>
        </div>
      </Card>
    )
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
          {'Upcoming'}
        </h2>
        {unpredictedCount > 0 && (
          <span className="text-xs font-medium text-primary">
            {unpredictedCount} {'to predict'}
          </span>
        )}
      </div>

      <div className="space-y-5">
        {visibleDays.map((day) => {
          // Pure chronological order within the day; competition shown as
          // a chip on each card instead of grouping.
          const sorted = [...day.matches].sort((a, b) =>
            a.match.kickoffTime.localeCompare(b.match.kickoffTime),
          )
          const dayLabel = formatDayLabel(day.date)
          // Highlight TODAY/TOMORROW with primary color; less imminent
          // future days get a muted treatment so the eye lands on
          // what's actually relevant right now.
          const isImminent = dayLabel === 'TODAY' || dayLabel === 'TOMORROW'

          return (
            <div key={day.key} className="space-y-3">
              <div className="sticky top-[4.5rem] z-[5] -mx-4 px-4 py-2.5 bg-background/95 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-border/50" />
                  <h3
                    className={cn(
                      'inline-flex items-center px-3 py-1 rounded-full',
                      'text-xs font-bold uppercase tracking-[0.15em]',
                      'border',
                      isImminent
                        ? 'bg-primary/15 text-primary border-primary/30'
                        : 'bg-secondary text-foreground border-border',
                    )}
                  >
                    {dayLabel}
                  </h3>
                  <div className="flex-1 h-px bg-border/50" />
                </div>
              </div>

              <div className="space-y-3">
                {sorted.map((u) => (
                  <UpcomingMatchCard
                    key={u.match.id}
                    summary={u}
                    competitionName={
                      showCompHeader
                        ? compNameById.get(u.match.competitionId) ?? null
                        : null
                    }
                    onPredict={() => onPredict(u.match.id)}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {remainingDays > 0 && nextDay && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-xs"
          onClick={() => setDaysShown((d) => d + 1)}
        >
          {`Load ${formatDayLabel(nextDay.date).toLowerCase().replace(/^\w/, (c) => c.toUpperCase())} `}
          <span className="text-muted-foreground ml-1">
            ({nextDay.matches.length}{' '}
            {nextDay.matches.length === 1 ? 'match' : 'matches'})
          </span>
          <ChevronDown className="h-3.5 w-3.5 ml-1" />
        </Button>
      )}

      {daysShown > DAYS_INITIAL && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-xs text-muted-foreground"
          onClick={() => setDaysShown(DAYS_INITIAL)}
        >
          {'Collapse'}
        </Button>
      )}
    </section>
  )
}

// ── Recent Results: last completed round only, expandable ───────────────────

function RecentResultsSection({
  completed,
  leagueId,
}: {
  completed: CompletedMatchSummary[]
  leagueId: UUID
}) {
  // Group by round and pick the most recent round (by kickoff_time within
  // the round). For league play this naturally maps to "last matchday";
  // for cups it's the most recent stage played.
  const { defaultRound, allRounds } = useMemo(() => {
    const byRound = new Map<UUID, CompletedMatchSummary[]>()
    for (const m of completed) {
      const arr = byRound.get(m.match.round.id) ?? []
      arr.push(m)
      byRound.set(m.match.round.id, arr)
    }
    // Sort rounds by latest match in each round, descending.
    const rounds = Array.from(byRound.entries())
      .map(([id, matches]) => ({
        id,
        name: matches[0].match.round.name,
        sortOrder: matches[0].match.round.sortOrder,
        matches: matches.sort((a, b) =>
          b.match.kickoffTime.localeCompare(a.match.kickoffTime),
        ),
        latestKickoff: matches.reduce(
          (latest, m) =>
            m.match.kickoffTime > latest ? m.match.kickoffTime : latest,
          '',
        ),
      }))
      .sort((a, b) => b.latestKickoff.localeCompare(a.latestKickoff))
    return {
      defaultRound: rounds[0],
      allRounds: rounds,
    }
  }, [completed])

  const [showAll, setShowAll] = useState(false)
  const visible = showAll ? allRounds : [defaultRound]

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
          {'Recent Results'}
        </h2>
        <span className="text-xs text-muted-foreground">
          {showAll
            ? `${allRounds.length} rounds`
            : defaultRound.name}
        </span>
      </div>

      {visible.map((round) => (
        <div key={round.id} className="space-y-1.5">
          {showAll && (
            <h3 className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wider px-1">
              {round.name}
            </h3>
          )}
          <Card className="bg-card border-border overflow-hidden divide-y divide-border/30">
            {round.matches.map((m) => (
              <CompletedMatchRow
                key={m.match.id}
                summary={m}
                leagueId={leagueId}
              />
            ))}
          </Card>
        </div>
      ))}

      {allRounds.length > 1 && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-xs"
          onClick={() => setShowAll((v) => !v)}
        >
          {showAll
            ? 'Show less'
            : `Show all ${allRounds.length} rounds`}
          <ChevronDown
            className={cn(
              'h-3.5 w-3.5 ml-1 transition-transform',
              showAll && 'rotate-180',
            )}
          />
        </Button>
      )}
    </section>
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
              {displayLiveMinute(match.liveMinute, match.status, match.kickoffTime) ?? 'LIVE'}
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
  const { data: currentUser } = useCurrentUser()
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
          const isUser = p.userId === currentUser?.id
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
        {/* "Live" column shown always — values render as em-dash when no
            points are in flight, so the column structure is consistent
            regardless of whether matches are happening right now. */}
        <span className="w-14 text-center">{'Live'}</span>
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
  const isUser = row.isCurrentUser
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
      <span
        className={cn(
          'w-14 text-center font-mono font-bold text-sm tabular-nums',
          row.matchdayPoints > 0
            ? 'text-primary'
            : 'text-muted-foreground/40',
        )}
      >
        {row.matchdayPoints > 0 ? `+${row.matchdayPoints}` : '—'}
      </span>
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

function CompletedMatchRow({
  summary,
  leagueId,
}: {
  summary: CompletedMatchSummary
  leagueId: UUID
}) {
  const { match, userPrediction } = summary
  const home = match.homeTeam?.name ?? 'TBD'
  const away = match.awayTeam?.name ?? 'TBD'
  const homeScore = match.homeScore ?? 0
  const awayScore = match.awayScore ?? 0

  // Status badge in the top-right of every card. Computed once so the
  // layout below stays branchless.
  let statusBadge: React.ReactNode
  if (!userPrediction) {
    statusBadge = (
      <Badge variant="secondary" className="text-xs gap-1 text-muted-foreground">
        {'No prediction'}
      </Badge>
    )
  } else {
    const isExact =
      userPrediction.homeScore === homeScore &&
      userPrediction.awayScore === awayScore
    const correctOutcome =
      Math.sign(userPrediction.homeScore - userPrediction.awayScore) ===
      Math.sign(homeScore - awayScore)
    if (isExact) {
      statusBadge = (
        <Badge className="bg-primary/15 text-primary border-0 text-xs gap-1">
          <Check className="h-3 w-3" />
          {'Exact'}
        </Badge>
      )
    } else if (correctOutcome) {
      statusBadge = (
        <Badge variant="secondary" className="text-xs gap-1">
          <Check className="h-3 w-3 text-emerald-500" />
          {'Outcome'}
        </Badge>
      )
    } else {
      statusBadge = (
        <Badge variant="secondary" className="text-xs gap-1 text-muted-foreground">
          <X className="h-3 w-3 text-destructive" />
          {'Wrong'}
        </Badge>
      )
    }
  }

  const total = userPrediction?.points?.total ?? 0

  return (
    <Link
      href={`/matches/${match.id}?league=${leagueId}`}
      className="block px-4 py-3 hover:bg-muted/40 transition-colors"
    >
      <div className="flex items-center justify-between mb-2">
        <Badge variant="secondary" className="text-xs">
          {match.round.name}
        </Badge>
        {statusBadge}
      </div>

      <div className="flex items-center gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between text-sm gap-2">
            <span className="font-semibold text-foreground truncate">{home}</span>
            <span className="font-bold text-foreground tabular-nums">
              {homeScore}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm gap-2">
            <span className="font-semibold text-foreground truncate">{away}</span>
            <span className="font-bold text-foreground tabular-nums">
              {awayScore}
            </span>
          </div>
        </div>
        <div className="w-px h-8 bg-border" />
        <div className="flex flex-col items-end w-16 flex-shrink-0">
          {userPrediction ? (
            <>
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
            </>
          ) : (
            <span className="text-xs text-muted-foreground/50">{'—'}</span>
          )}
        </div>
      </div>
    </Link>
  )
}

// ── Upcoming match card ──────────────────────────────────────────────────────
//
// Visual rules:
//   • Chip top-left: competition name (only when league tracks multiple)
//     and round name
//   • Time top-right: gets red/urgent treatment when match is < 2h away
//     AND user hasn't predicted yet (drives them to predict NOW)
//   • Booster color: card border + background tinted to the booster color
//     when the user's prediction has a booster applied. Mirrors the
//     treatment on live-match prediction rows.
//   • Predicted state: large prediction badge + bold Edit button (high
//     visibility — you should always know if you've already picked).
//   • Unpredicted state: full-width primary CTA.

const URGENT_KICKOFF_MIN = 2 * 60 // 2 hours

const BOOSTER_CARD_STYLES: Record<
  Exclude<NonNullable<UpcomingMatchSummary['userPrediction']>['booster'], null>,
  { border: string; bg: string; pillBg: string; pillText: string }
> = {
  x2: {
    border: 'border-emerald-400/50',
    bg: 'bg-emerald-400/[0.03]',
    pillBg: 'bg-emerald-400/15',
    pillText: 'text-emerald-400',
  },
  x3: {
    border: 'border-sky-400/50',
    bg: 'bg-sky-400/[0.03]',
    pillBg: 'bg-sky-400/15',
    pillText: 'text-sky-400',
  },
  x5: {
    border: 'border-amber-400/50',
    bg: 'bg-amber-400/[0.03]',
    pillBg: 'bg-amber-400/15',
    pillText: 'text-amber-400',
  },
}

function UpcomingMatchCard({
  summary,
  competitionName,
  onPredict,
}: {
  summary: UpcomingMatchSummary
  competitionName: string | null
  onPredict: () => void
}) {
  const { match, userPrediction } = summary
  const home = match.homeTeam?.name ?? 'TBD'
  const away = match.awayTeam?.name ?? 'TBD'

  // Capture wall-time once at mount. Re-evaluated on every TanStack
  // refetch (default staleTime 30s) which is plenty fresh for the
  // "urgent" threshold; we don't need a per-second ticker.
  const [now] = useState(() => Date.now())
  const minutesToKickoff =
    (new Date(match.kickoffTime).getTime() - now) / 60_000
  const isUrgent =
    !userPrediction &&
    minutesToKickoff > 0 &&
    minutesToKickoff < URGENT_KICKOFF_MIN

  const booster = userPrediction?.booster ?? null
  const boostStyle = booster ? BOOSTER_CARD_STYLES[booster] : null

  return (
    <Card
      className={cn(
        'p-4 bg-card border-border transition-colors',
        boostStyle && [boostStyle.border, boostStyle.bg],
      )}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {competitionName && (
            <Badge variant="secondary" className="text-[10px] flex-shrink-0">
              {competitionName}
            </Badge>
          )}
          <Badge variant="secondary" className="text-[10px] truncate">
            {match.round.name}
          </Badge>
        </div>
        <div
          className={cn(
            'flex items-center gap-1 flex-shrink-0',
            isUrgent
              ? 'text-destructive font-bold animate-pulse'
              : 'text-muted-foreground',
          )}
        >
          <Clock className={cn('h-3 w-3', isUrgent && 'h-3.5 w-3.5')} />
          <span
            className={cn('font-medium', isUrgent ? 'text-sm' : 'text-xs')}
          >
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
        <button
          type="button"
          onClick={onPredict}
          className={cn(
            'w-full pt-3 border-t border-border/60 flex items-center justify-between gap-3 group',
            'rounded-b -mx-4 px-4 -mb-4 pb-4 hover:bg-muted/30 transition-colors',
          )}
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
              {'Your pick'}
            </span>
            <span className="font-mono font-bold text-lg tabular-nums text-foreground">
              {userPrediction.homeScore}-{userPrediction.awayScore}
            </span>
            {booster && boostStyle && (
              <span
                className={cn(
                  'inline-flex items-center gap-0.5 rounded-full px-1.5 py-px text-[10px] font-black leading-tight',
                  boostStyle.pillBg,
                  boostStyle.pillText,
                )}
              >
                <Zap className="h-2.5 w-2.5" />
                {booster}
              </span>
            )}
          </div>
          <span className="flex items-center gap-1 text-xs font-semibold text-primary group-hover:underline flex-shrink-0">
            {'Edit'}
            <ChevronRight className="h-3.5 w-3.5" />
          </span>
        </button>
      ) : (
        <Button
          variant={isUrgent ? 'destructive' : 'default'}
          className="w-full mt-1"
          onClick={onPredict}
        >
          {isUrgent ? 'Predict now' : 'Make Prediction'}
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      )}
    </Card>
  )
}

