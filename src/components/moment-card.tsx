'use client'

// "Stadium Broadcast" match-story cards. A MomentCard turns one finished match
// into a story: it always carries the all-players OverviewStrip (who predicted,
// how the league split, who cashed in) and elevates a standout headline Moment
// when there is one. MomentRow is the compact variant for the match-detail
// "The Story" list. Visual identity per kind lives in MOMENT_VISUAL — amber
// stays the points/identity colour; `destructive` is intentionally never used
// (it's reserved for live/urgency, and finished highlights aren't live).

import Link from 'next/link'
import { cn } from '@/lib/utils'
import {
  Avatar,
  BOOSTER_PILL,
  BOOSTER_RAIL,
  BoosterPill,
  Crest,
  teamCode,
  teamName,
} from '@/components/match-ui'
import type {
  MatchOverview,
  Moment,
  MomentFeedItem,
  MomentKind,
  MomentViewer,
  Profile,
  Team,
} from '@/types'

// glyph + left-rail colour + glyph-chip background per kind.
const MOMENT_VISUAL: Record<MomentKind, { glyph: string; rail: string; chip: string }> = {
  exact: { glyph: '🎯', rail: 'bg-primary', chip: 'bg-primary/15' },
  haul: { glyph: '🔥', rail: 'bg-primary', chip: 'bg-primary/15' },
  contrarian: { glyph: '🧊', rail: 'bg-info', chip: 'bg-info/15' },
  booster: { glyph: '🎲', rail: 'bg-warning', chip: 'bg-warning/15' },
  mover: { glyph: '📈', rail: 'bg-success', chip: 'bg-success/15' },
  collective: { glyph: '👥', rail: 'bg-foreground/35', chip: 'bg-secondary' },
}

// Used when a card has no standout headline — it leads with the overview.
const OVERVIEW_VISUAL = { glyph: '📊', rail: 'bg-foreground/20', chip: 'bg-secondary' }

function visualFor(m: Moment): { glyph: string; rail: string; chip: string } {
  // Booster moments take the booster's tier colour (x2 green / x3 sky / x5 amber).
  if (m.kind === 'booster' && m.booster) {
    return { glyph: '🎲', rail: BOOSTER_RAIL[m.booster], chip: BOOSTER_PILL[m.booster] }
  }
  return MOMENT_VISUAL[m.kind]
}

function overviewHeadline(o: MatchOverview): string {
  if (o.predictionCount === 0) return 'No one predicted this'
  if (!o.consensus) return 'How the league called it'
  const { side, team, count } = o.consensus
  const label = side === 'draw' ? 'a draw' : teamName(team)
  return `${count} of ${o.predictionCount} backed ${label}`
}

function matchOutcome(hs: number, as: number): 'home' | 'draw' | 'away' {
  if (hs > as) return 'home'
  if (hs < as) return 'away'
  return 'draw'
}

// One-line read on how the room did — the consensus measured against the actual
// result. Null only when nobody predicted (the crowd strip is then hidden).
function crowdVerdict(o: MatchOverview, hs: number, as: number): string | null {
  if (o.predictionCount === 0) return null
  if (o.correctCount === 0) return 'Nobody saw it coming'
  if (o.predictionCount >= 2 && o.correctCount === o.predictionCount) {
    return 'Everyone called it'
  }
  if (o.consensus) {
    return o.consensus.side === matchOutcome(hs, as)
      ? 'Crowd called it'
      : 'Crowd got it wrong'
  }
  return null
}

function GlyphChip({
  glyph,
  chip,
  className,
}: {
  glyph: string
  chip: string
  className?: string
}) {
  return (
    <span
      className={cn(
        'grid place-items-center rounded-[7px] shrink-0',
        chip,
        className,
      )}
    >
      {glyph}
    </span>
  )
}

function MomentActors({ actors, max = 3 }: { actors: Profile[]; max?: number }) {
  const shown = actors.slice(0, max)
  const extra = actors.length - shown.length
  return (
    <span className="flex items-center">
      <span className="flex -space-x-2">
        {shown.map((p) => (
          <span key={p.id} className="rounded-full ring-1 ring-card">
            <Avatar profile={p} size="sm" />
          </span>
        ))}
      </span>
      {extra > 0 && (
        <span className="ml-1.5 font-mono text-[11px] text-muted-foreground">
          {'+'}
          {extra}
        </span>
      )}
    </span>
  )
}

function MomentLeagueTag({
  league,
}: {
  league: { name: string; icon: string | null }
}) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-secondary px-2 py-[3px] text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground max-w-[140px]">
      {league.icon && <span className="shrink-0">{league.icon}</span>}
      <span className="truncate">{league.name}</span>
    </span>
  )
}

// Final score with flags + team abbreviations: "🇳🇱 NED 5–1 SWE 🇸🇪". The losing
// side is dimmed. Reuses the shared Crest (flag) + teamCode (abbreviation).
function ScoreLine({
  home,
  away,
  homeScore,
  awayScore,
}: {
  home: Team | null
  away: Team | null
  homeScore: number
  awayScore: number
}) {
  const homeLost = homeScore < awayScore
  const awayLost = awayScore < homeScore
  return (
    <span className="flex shrink-0 items-center gap-1.5">
      <Crest team={home} size="xs" />
      <span
        className={cn(
          'font-mono text-[10px] font-bold uppercase tracking-[0.04em] text-muted-foreground',
          homeLost && 'opacity-45',
        )}
      >
        {teamCode(home)}
      </span>
      <span
        className={cn(
          'font-display text-[24px] font-black leading-none tracking-[-0.03em]',
          homeLost && 'opacity-45',
        )}
      >
        {homeScore}
      </span>
      <span className="font-display text-[14px] font-black leading-none text-dim">
        {'–'}
      </span>
      <span
        className={cn(
          'font-display text-[24px] font-black leading-none tracking-[-0.03em]',
          awayLost && 'opacity-45',
        )}
      >
        {awayScore}
      </span>
      <span
        className={cn(
          'font-mono text-[10px] font-bold uppercase tracking-[0.04em] text-muted-foreground',
          awayLost && 'opacity-45',
        )}
      >
        {teamCode(away)}
      </span>
      <Crest team={away} size="xs" />
    </span>
  )
}

// Always-on league roll-up: "N played · M correct · K eksakt" + a proportional
// home/draw/away split bar. Caller frames it (border-t in a card footer,
// border-b as a match-detail header) via `className`.
export function OverviewStrip({
  overview,
  className,
}: {
  overview: MatchOverview
  className?: string
}) {
  const { predictionCount, correctCount, exactCount, homeCount, drawCount, awayCount } =
    overview
  const splitTotal = Math.max(1, homeCount + drawCount + awayCount)
  const seg = (n: number, cls: string) =>
    n > 0 ? (
      <span className={cls} style={{ width: `${(n / splitTotal) * 100}%` }} />
    ) : null

  return (
    <div className={cn('flex items-center gap-3 px-4 py-2', className)}>
      <span className="whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.06em] text-dim">
        {predictionCount}
        {' played · '}
        {correctCount}
        {' correct'}
        {exactCount > 0 && (
          <span className="text-primary">
            {' · '}
            {exactCount}
            {' eksakt'}
          </span>
        )}
      </span>
      <span
        className="flex h-[5px] flex-1 overflow-hidden rounded-full bg-secondary"
        title={`${homeCount} home · ${drawCount} draw · ${awayCount} away`}
      >
        {seg(homeCount, 'bg-primary/55')}
        {seg(drawCount, 'bg-muted-foreground/40')}
        {seg(awayCount, 'bg-info/55')}
      </span>
    </div>
  )
}

// "You scored" strip — the personal result on the league Played feed: the
// Eksakt / Outcome / Missed badge (the played-card vocabulary the league board
// used) plus your points, tier-coloured (≥5 amber, ≥1 white, 0 dim).
const VIEWER_TAG: Record<MomentViewer['status'], { label: string; cls: string }> =
  {
    exact: { label: 'Eksakt', cls: 'bg-primary text-background' },
    outcome: { label: 'Outcome', cls: 'bg-secondary text-foreground' },
    wrong: { label: 'Missed', cls: 'border border-destructive text-destructive' },
    none: { label: 'No pick', cls: 'bg-secondary text-muted-foreground' },
  }

// Left-rail colour keyed to the viewer's own result, so the Played feed scans
// at a glance: amber = your Eksakt, dim = outcome, red = missed (the league
// board's played-card rail).
const VIEWER_RAIL: Record<MomentViewer['status'], string> = {
  exact: 'bg-primary',
  outcome: 'bg-foreground/35',
  wrong: 'bg-destructive/50',
  none: 'bg-transparent',
}

function ViewerResultStrip({ viewer }: { viewer: MomentViewer }) {
  const tag = VIEWER_TAG[viewer.status]
  const t = viewer.points
  return (
    <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-2">
      <span className="flex items-center gap-2">
        <span className="text-[9px] font-extrabold uppercase tracking-[0.2em] text-muted-foreground">
          {'You'}
        </span>
        <span
          className={cn(
            'rounded-[4px] px-[7px] py-[3px] font-display text-[11px] font-black uppercase leading-none tracking-[0.1em]',
            tag.cls,
          )}
        >
          {tag.label}
        </span>
        {viewer.homeScore != null && viewer.awayScore != null && (
          <span className="font-mono text-[11px] text-muted-foreground">
            {viewer.homeScore}
            {'–'}
            {viewer.awayScore}
          </span>
        )}
      </span>
      <span
        className={cn(
          'font-display text-[30px] font-black leading-none tracking-[-0.03em]',
          t >= 4 ? 'text-primary' : t >= 1 ? 'text-foreground' : 'text-dim',
        )}
      >
        {viewer.status === 'none' ? '—' : t > 0 ? `+${t}` : '0'}
      </span>
    </div>
  )
}

// Feed card (Played tab + dashboard). `showLeagueTag` adds the origin pill
// (cross-league dashboard); `showViewerResult` adds the "you scored" strip
// (single-league Played feed).
export function MomentCard({
  item,
  showLeagueTag = false,
  showViewerResult = false,
}: {
  item: MomentFeedItem
  showLeagueTag?: boolean
  showViewerResult?: boolean
}) {
  const { match, league, overview, headline } = item
  const hs = match.homeScore ?? 0
  const as = match.awayScore ?? 0

  const v = headline ? visualFor(headline) : OVERVIEW_VISUAL
  const actors = headline?.actors ?? (headline?.actor ? [headline.actor] : [])
  // A "person" story is a standout someone owns (vs a whole-league collective).
  const isPerson = Boolean(headline && headline.kind !== 'collective' && actors.length > 0)

  const verdict = crowdVerdict(overview, hs, as)
  // Story line: the person's standout when there is one, else the crowd verdict.
  const storyText = isPerson
    ? headline!.headline
    : (verdict ?? overviewHeadline(overview))
  const storyPoints = isPerson ? headline!.points : undefined

  // Crowd strip — who won the match + how many nailed it. Only bill a "winner"
  // when the haul is actually meaningful (≥3; a lone +1 isn't a win), and
  // suppress it when it's the same player the story line already features.
  const topScorer = overview.topScorer
  const showHaul =
    topScorer != null &&
    overview.topPoints >= 3 &&
    !(isPerson && topScorer.id === actors[0]?.id)
  const crowdStats = [
    showHaul ? `${topScorer!.displayName} +${overview.topPoints}` : null,
    overview.exactCount > 0 ? `${overview.exactCount} Eksakt` : null,
  ]
    .filter(Boolean)
    .join(' · ')
  // Left of the bar: the verdict (when the story is a person) else participation
  // — so the verdict shows exactly once.
  const crowdLead = isPerson ? verdict : `${overview.predictionCount} played`

  // On the Played feed the rail reflects YOUR result; on the dashboard it
  // reflects the headline story's kind.
  const rail =
    showViewerResult && item.viewer ? VIEWER_RAIL[item.viewer.status] : v.rail

  const splitTotal = Math.max(
    1,
    overview.homeCount + overview.drawCount + overview.awayCount,
  )
  const seg = (n: number, cls: string) =>
    n > 0 ? (
      <span className={cls} style={{ width: `${(n / splitTotal) * 100}%` }} />
    ) : null

  return (
    <Link
      href={`/matches/${match.id}?league=${league.id}`}
      className="relative block overflow-hidden rounded-[12px] border border-border bg-card mb-[10px] hover:border-hair-strong transition-colors"
    >
      <span className={cn('absolute left-0 top-0 bottom-0 w-[3px]', rail)} />

      {/* header: the fixture leads — glyph + flags + abbreviations + score */}
      <div className="flex items-center justify-between gap-2 pt-[11px] pr-[14px] pl-4">
        <span className="flex min-w-0 items-center gap-2">
          <GlyphChip
            glyph={v.glyph}
            chip={v.chip}
            className="size-[22px] shrink-0 text-[12px]"
          />
          <ScoreLine
            home={match.homeTeam}
            away={match.awayTeam}
            homeScore={hs}
            awayScore={as}
          />
        </span>
        {showLeagueTag && <MomentLeagueTag league={league} />}
      </div>

      {/* story: who starred (a person) or the crowd verdict */}
      <div className="pt-2 pr-[14px] pl-4">
        <div className="flex items-center gap-2">
          {isPerson && actors.length === 1 && (
            <Avatar profile={actors[0]} size="sm" />
          )}
          <span className="min-w-0 flex-1 truncate font-display text-[15px] font-extrabold uppercase leading-tight tracking-[0.005em]">
            {storyText}
          </span>
          {headline?.booster && <BoosterPill booster={headline.booster} />}
          {typeof storyPoints === 'number' && storyPoints > 0 && (
            <span className="shrink-0 font-display text-[18px] font-black leading-none tracking-[-0.02em] text-primary">
              {'+'}
              {storyPoints}
            </span>
          )}
        </div>
        {/* Name the players behind a shared moment (e.g. the Eksakt-getters)
            rather than showing anonymous avatars. */}
        {isPerson && actors.length > 1 && (
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
            {actors.slice(0, 4).map((a) => (
              <span key={a.id} className="inline-flex items-center gap-1.5">
                <Avatar profile={a} size="xs" />
                <span className="text-[12px] font-medium">{a.displayName}</span>
              </span>
            ))}
            {actors.length > 4 && (
              <span className="font-mono text-[11px] text-muted-foreground">
                {'+'}
                {actors.length - 4}
              </span>
            )}
          </div>
        )}
      </div>

      {/* crowd: verdict / participation + who won + exacts, over the split bar */}
      {overview.predictionCount > 0 && (
        <div className="px-4 pt-2.5 pb-2.5">
          <div className="mb-1.5 flex items-center justify-between gap-2 font-mono text-[10px] uppercase tracking-[0.06em]">
            <span className="truncate text-muted-foreground">{crowdLead}</span>
            {crowdStats && <span className="shrink-0 text-dim">{crowdStats}</span>}
          </div>
          <span
            className="flex h-[5px] overflow-hidden rounded-full bg-secondary"
            title={`${overview.homeCount} home · ${overview.drawCount} draw · ${overview.awayCount} away`}
          >
            {seg(overview.homeCount, 'bg-primary/55')}
            {seg(overview.drawCount, 'bg-muted-foreground/40')}
            {seg(overview.awayCount, 'bg-info/55')}
          </span>
        </div>
      )}

      {showViewerResult && item.viewer && (
        <ViewerResultStrip viewer={item.viewer} />
      )}
    </Link>
  )
}

// Compact single-standout row for the match-detail "The Story" list.
export function MomentRow({ moment }: { moment: Moment }) {
  const v = visualFor(moment)
  const actors = moment.actors ?? (moment.actor ? [moment.actor] : [])

  return (
    <div className="flex items-start gap-3 border-b border-border px-4 py-3 last:border-b-0">
      <GlyphChip
        glyph={v.glyph}
        chip={v.chip}
        className="mt-0.5 size-7 text-[14px]"
      />
      <div className="min-w-0 flex-1">
        <p className="font-display text-[14px] font-bold uppercase leading-tight tracking-[0.01em]">
          {moment.headline}
        </p>
        <div className="mt-1 flex min-w-0 items-center gap-2">
          {actors.length === 1 ? (
            <>
              <Avatar profile={actors[0]} size="xs" />
              <span className="truncate text-[12px] text-muted-foreground">
                {actors[0].displayName}
              </span>
            </>
          ) : actors.length > 1 ? (
            <MomentActors actors={actors} max={4} />
          ) : moment.subtext ? (
            <span className="truncate text-[12px] text-muted-foreground">
              {moment.subtext}
            </span>
          ) : null}
          {moment.booster && <BoosterPill booster={moment.booster} />}
        </div>
      </div>
      {typeof moment.points === 'number' && moment.points > 0 && (
        <span className="mt-0.5 shrink-0 font-display text-[20px] font-black leading-none text-primary">
          {'+'}
          {moment.points}
        </span>
      )}
    </div>
  )
}
