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
  teamName,
} from '@/components/match-ui'
import type {
  MatchOverview,
  Moment,
  MomentFeedItem,
  MomentKind,
  MomentViewer,
  Profile,
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
          'font-display text-[22px] font-black leading-none tracking-[-0.03em]',
          t >= 5 ? 'text-primary' : t >= 1 ? 'text-foreground' : 'text-dim',
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
  const homeLost = hs < as
  const awayLost = as < hs

  const v = headline ? visualFor(headline) : OVERVIEW_VISUAL
  const headlineText = headline ? headline.headline : overviewHeadline(overview)
  const subtext = headline?.subtext
  const actors = headline?.actors ?? (headline?.actor ? [headline.actor] : [])

  // On the Played feed the rail reflects YOUR result; on the dashboard it
  // reflects the headline story's kind.
  const rail =
    showViewerResult && item.viewer ? VIEWER_RAIL[item.viewer.status] : v.rail

  return (
    <Link
      href={`/matches/${match.id}?league=${league.id}`}
      className="relative block overflow-hidden rounded-[12px] border border-border bg-card mb-[10px] hover:border-hair-strong transition-colors"
    >
      <span className={cn('absolute left-0 top-0 bottom-0 w-[3px]', rail)} />

      <div className="flex items-center justify-between gap-2 pt-[11px] pr-[14px] pl-4">
        <span className="flex min-w-0 items-center gap-2">
          <GlyphChip glyph={v.glyph} chip={v.chip} className="size-[22px] text-[12px]" />
          <span className="truncate text-[10px] font-extrabold uppercase tracking-[0.18em] text-muted-foreground">
            {match.round.name} {'· Final'}
          </span>
        </span>
        {showLeagueTag && <MomentLeagueTag league={league} />}
      </div>

      <div className="grid grid-cols-[1fr_1px_auto] items-center gap-[14px] pt-2.5 pb-3 pr-[14px] pl-4">
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="line-clamp-2 font-display text-[17px] font-extrabold uppercase leading-[1.05] tracking-[0.005em]">
            {headlineText}
          </span>
          {subtext && (
            <span className="truncate text-[12px] leading-snug text-muted-foreground">
              {subtext}
            </span>
          )}
          {actors.length > 0 && (
            <span className="mt-0.5 flex min-w-0 items-center gap-2">
              {actors.length === 1 ? (
                <>
                  <Avatar profile={actors[0]} size="sm" />
                  <span className="truncate text-[13px] font-medium">
                    {actors[0].displayName}
                  </span>
                </>
              ) : (
                <MomentActors actors={actors} />
              )}
              {headline?.booster && <BoosterPill booster={headline.booster} />}
            </span>
          )}
        </div>

        <span className="h-[44px] w-px bg-border" />

        <div className="flex min-w-[64px] flex-col items-end gap-[3px]">
          <span className="text-[9px] font-extrabold uppercase tracking-[0.2em] text-muted-foreground">
            {'Final'}
          </span>
          <span className="flex items-center gap-1.5">
            <Crest team={match.homeTeam} size="xs" />
            <span
              className={cn(
                'font-display text-[26px] font-black leading-none tracking-[-0.03em]',
                homeLost && 'opacity-45',
              )}
            >
              {hs}
            </span>
            <span className="font-display text-[15px] font-black leading-none text-dim">
              {'–'}
            </span>
            <span
              className={cn(
                'font-display text-[26px] font-black leading-none tracking-[-0.03em]',
                awayLost && 'opacity-45',
              )}
            >
              {as}
            </span>
            <Crest team={match.awayTeam} size="xs" />
          </span>
        </div>
      </div>

      {overview.predictionCount > 0 && (
        <OverviewStrip overview={overview} className="border-t border-border" />
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
