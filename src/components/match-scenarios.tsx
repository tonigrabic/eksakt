'use client'

// Live-match "Stadium Broadcast" extras. While a match is undecided we can show
// two things the live table can't: the PredictionBoard (who picked what, grouped
// by outcome then scoreline) and NextGoalScenarios (who's in for the big points
// and what needs to happen — the next-goal results run through the real scorer).
// Pure presentation over the derivations in derive.ts.

import { cn } from '@/lib/utils'
import {
  Avatar,
  BoosterPill,
  Crest,
  teamName,
} from '@/components/match-ui'
import { OverviewStrip } from '@/components/moment-card'
import type {
  Match,
  MatchOverview,
  MatchScenario,
  PredictionGroup,
  Profile,
} from '@/types'

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

// ── Next-goal scenarios ───────────────────────────────────────────────────────
//
// "Who's in for the big points and what needs to happen." Each card is one
// next-goal result (a home goal / an away goal from the current score) and the
// players who'd nail that exact scoreline — their projected total, boosters and
// rarity included — biggest haul first.

const SCORER_RAIL: Record<'home' | 'away', string> = {
  home: 'bg-primary',
  away: 'bg-info',
}

function NextGoalCard({
  scenario,
  match,
}: {
  scenario: MatchScenario
  match: Match
}) {
  const { finalScore, scorer, overview } = scenario
  const winners = scenario.winners ?? []
  const scorerTeam = scorer === 'away' ? match.awayTeam : match.homeTeam
  const shown = winners.slice(0, 3)
  const extra = winners.length - shown.length

  return (
    <div className="relative overflow-hidden rounded-[10px] border border-border bg-card mb-[10px]">
      <span
        className={cn(
          'absolute left-0 top-0 bottom-0 w-[3px]',
          SCORER_RAIL[scorer ?? 'home'],
        )}
      />

      {/* what needs to happen */}
      <div className="flex items-center justify-between gap-2 px-4 pt-[10px] pb-1.5 pl-[18px]">
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <Crest team={scorerTeam} size="xs" />
          <span className="truncate font-display text-[13px] font-extrabold uppercase tracking-[0.02em]">
            {teamName(scorerTeam)}
          </span>
          <span className="shrink-0 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
            {'goal'}
          </span>
        </span>
        <span className="shrink-0 font-display text-[16px] font-black tabular-nums tracking-[-0.03em]">
          {'→ '}
          {finalScore.home}
          {'–'}
          {finalScore.away}
        </span>
      </div>

      {/* who's in for the big points */}
      <div className="px-4 pb-3 pl-[18px]">
        {winners.length > 0 ? (
          <ul className="flex flex-col gap-1.5">
            {shown.map((w) => (
              <li key={w.profile.id} className="flex items-center gap-2">
                <Avatar profile={w.profile} size="xs" />
                <span className="truncate text-[13px] font-medium">
                  {w.profile.displayName}
                </span>
                {w.booster && <BoosterPill booster={w.booster} />}
                <span className="ml-auto shrink-0 font-display text-[18px] font-black leading-none tracking-[-0.02em] text-primary">
                  {'+'}
                  {w.points}
                </span>
              </li>
            ))}
            {extra > 0 && (
              <li className="text-[11px] text-muted-foreground">
                {`+${extra} more nail it`}
              </li>
            )}
          </ul>
        ) : (
          <p className="text-[12px] leading-snug text-muted-foreground">
            {`No one called ${finalScore.home}–${finalScore.away}`}
            {overview.topScorer
              ? ` · ${overview.topScorer.displayName} leads on outcome +${overview.topPoints}`
              : ''}
          </p>
        )}
      </div>
    </div>
  )
}

// Next-goal cards for a live match; renders nothing when there are none.
export function NextGoalScenarios({
  scenarios,
  match,
}: {
  scenarios: MatchScenario[]
  match: Match
}) {
  if (scenarios.length === 0) return null
  return (
    <div>
      {scenarios.map((s) => (
        <NextGoalCard
          key={s.scorer ?? `${s.finalScore.home}-${s.finalScore.away}`}
          scenario={s}
          match={match}
        />
      ))}
    </div>
  )
}
