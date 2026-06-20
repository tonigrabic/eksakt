'use client'

// Live-match "Stadium Broadcast" extras. While a match is undecided we can show
// two things the finished "The Story" can't: the PredictionBoard (who picked
// what, grouped by outcome then scoreline) and ScenariosSection (a few
// plausible final scores run through the real scorer, each with the league
// story it would produce). Pure presentation over the derivations in derive.ts.

import { cn } from '@/lib/utils'
import {
  Avatar,
  BoosterPill,
  Crest,
  teamName,
} from '@/components/match-ui'
import { OverviewStrip } from '@/components/moment-card'
import type {
  MatchOverview,
  MatchScenario,
  MomentKind,
  PredictionGroup,
  Profile,
} from '@/types'

const KIND_GLYPH: Record<MomentKind, string> = {
  exact: '🎯',
  haul: '🔥',
  contrarian: '🧊',
  booster: '🎲',
  mover: '📈',
  collective: '👥',
}

// Left-rail / accent per outcome side — mirrors the OverviewStrip split colours.
const SIDE_RAIL: Record<'home' | 'draw' | 'away', string> = {
  home: 'bg-primary',
  draw: 'bg-muted-foreground/40',
  away: 'bg-info',
}

// -space-x-2 avatar stack with a +N overflow (mirrors MomentActors).
function PlayerStack({ players, max = 5 }: { players: Profile[]; max?: number }) {
  const shown = players.slice(0, max)
  const extra = players.length - shown.length
  return (
    <span className="flex items-center">
      <span className="flex -space-x-2">
        {shown.map((p) => (
          <span key={p.id} className="rounded-full ring-1 ring-card">
            <Avatar profile={p} size="xs" />
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

// ── Who picked what ───────────────────────────────────────────────────────────

// The board: one shared split bar (outcome-independent) then, per outcome side,
// the distinct scorelines and who backed each. Live-only — peers' picks unlock
// at kickoff.
export function PredictionBoard({
  groups,
  overview,
}: {
  groups: PredictionGroup[]
  overview: MatchOverview
}) {
  return (
    <div className="overflow-hidden rounded-[12px] border border-border bg-card">
      <OverviewStrip overview={overview} className="border-b border-border" />
      {groups.map((g) => (
        <div key={g.side} className="border-b border-border last:border-b-0">
          <div className="flex items-center gap-2 px-4 pt-[9px] pb-1.5">
            <span className={cn('h-3.5 w-[3px] rounded-full', SIDE_RAIL[g.side])} />
            {g.team && <Crest team={g.team} size="xs" />}
            <span className="truncate text-[11px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground">
              {g.side === 'draw' ? 'Draw' : teamName(g.team)}
            </span>
            <span className="flex-1" />
            <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-dim">
              {g.count}
              {g.count === 1 ? ' pick' : ' picks'}
            </span>
          </div>
          {g.scorelines.map((s) => (
            <div
              key={`${s.homeScore}-${s.awayScore}`}
              className="flex items-center gap-3 px-4 pb-2 pl-[18px]"
            >
              <span className="w-[34px] shrink-0 font-display text-[15px] font-black tabular-nums tracking-[-0.02em]">
                {s.homeScore}
                {'–'}
                {s.awayScore}
              </span>
              <PlayerStack players={s.players} />
              {s.booster && (
                <span className="ml-auto">
                  <BoosterPill booster={s.booster} />
                </span>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

// ── Outcome scenarios ─────────────────────────────────────────────────────────

// A compact stat line from the projected overview: the lead scorer + the
// correct/exact tallies under this hypothetical result.
function scenarioStatLine(o: MatchOverview): string {
  if (o.topPoints <= 0 || !o.topScorer) {
    return o.predictionCount > 0 ? 'No points on the board' : 'No picks'
  }
  const bits = [`${o.topScorer.displayName} tops it +${o.topPoints}`]
  if (o.exactCount > 0) bits.push(`${o.exactCount} Eksakt`)
  bits.push(`${o.correctCount} correct`)
  return bits.join(' · ')
}

// The live story "as it stands" — the current-score scenario, elevated. Every
// goal re-scores the picks, so this headline re-writes itself in real time
// ("Nobody saw 0–0 coming" → "Sam's on for the Eksakt" the moment a goal lands).
export function LiveHeadline({ scenario }: { scenario: MatchScenario }) {
  const { side, overview, headline } = scenario
  return (
    <div className="relative overflow-hidden rounded-[12px] border border-border bg-card mb-3">
      <span className={cn('absolute left-0 top-0 bottom-0 w-[3px]', SIDE_RAIL[side])} />
      <div className="px-4 py-3 pl-[18px]">
        <span className="mb-1.5 inline-flex items-center gap-[5px] text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground">
          <span className="size-[6px] rounded-full bg-destructive animate-pulse" />
          {'As it stands'}
        </span>
        <p className="font-display text-[18px] font-extrabold uppercase leading-[1.05] tracking-[0.005em]">
          {headline ? (
            <>
              <span className="mr-1.5">{KIND_GLYPH[headline.kind]}</span>
              {headline.headline}
            </>
          ) : overview.predictionCount > 0 ? (
            'Still anyone’s game'
          ) : (
            'No one predicted this'
          )}
        </p>
        <p className="mt-1 text-[12px] leading-snug text-muted-foreground">
          {scenarioStatLine(overview)}
        </p>
      </div>
    </div>
  )
}

function ScenarioCard({ scenario }: { scenario: MatchScenario }) {
  const { finalScore, side, isCurrent, overview, headline } = scenario
  return (
    <div className="relative overflow-hidden rounded-[10px] border border-border bg-card mb-[10px]">
      <span className={cn('absolute left-0 top-0 bottom-0 w-[3px]', SIDE_RAIL[side])} />

      <div className="flex items-center justify-between gap-2 px-4 pt-[9px] pl-[18px]">
        <span className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground">
          {isCurrent ? 'If it stays' : 'If it ends'}
        </span>
        <span className="font-display text-[18px] font-black tabular-nums tracking-[-0.03em]">
          {finalScore.home}
          {'–'}
          {finalScore.away}
        </span>
      </div>

      <div className="px-4 pb-3 pt-1.5 pl-[18px]">
        <p className="font-display text-[14px] font-bold uppercase leading-tight tracking-[0.01em]">
          {headline ? (
            <>
              <span className="mr-1.5">{KIND_GLYPH[headline.kind]}</span>
              {headline.headline}
            </>
          ) : overview.predictionCount > 0 ? (
            'How the league called it'
          ) : (
            'No one predicted this'
          )}
        </p>
        <p className="mt-1 text-[12px] leading-snug text-muted-foreground">
          {scenarioStatLine(overview)}
        </p>
      </div>
    </div>
  )
}

// Scenario cards for a live match; renders nothing when there are none.
export function ScenariosSection({ scenarios }: { scenarios: MatchScenario[] }) {
  if (scenarios.length === 0) return null
  return (
    <div>
      {scenarios.map((s) => (
        <ScenarioCard
          key={`${s.finalScore.home}-${s.finalScore.away}`}
          scenario={s}
        />
      ))}
    </div>
  )
}
