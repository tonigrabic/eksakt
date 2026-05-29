'use client'

// Shared "Stadium Broadcast" match primitives used by the league board and
// the dashboard so the two never drift: team crests (real emblems from the
// football-data.org API with a country-code fallback), booster pills, and a
// few formatting helpers.

import { useState } from 'react'
import { Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Booster, Team } from '@/types'

// Booster pill + left-rail colours. x2→green(success) x3→sky(info) x5→amber(warning).
export const BOOSTER_PILL: Record<Booster, string> = {
  x2: 'text-success bg-success/20',
  x3: 'text-info bg-info/20',
  x5: 'text-warning bg-warning/20',
}
export const BOOSTER_RAIL: Record<Booster, string> = {
  x2: 'bg-success',
  x3: 'bg-info',
  x5: 'bg-warning',
}

export function teamCode(team: Team | null): string {
  if (team?.shortName) return team.shortName.slice(0, 3).toUpperCase()
  if (team?.name) return team.name.slice(0, 3).toUpperCase()
  return 'TBD'
}

export function teamName(team: Team | null): string {
  return team?.name ?? 'TBD'
}

// 95 → "1h 35m", 45 → "45m", 120 → "2h". Compact + human.
export function formatCountdown(mins: number): string {
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

// Just the wall-clock time, e.g. "21:00".
export function formatClock(iso: string): string {
  const d = new Date(iso)
  return `${d.getHours().toString().padStart(2, '0')}:${d
    .getMinutes()
    .toString()
    .padStart(2, '0')}`
}

// 1→"st", 2→"nd", 3→"rd", else "th".
export function nth(n: number): string {
  const v = n % 100
  if (v >= 11 && v <= 13) return 'th'
  if (n % 10 === 1) return 'st'
  if (n % 10 === 2) return 'nd'
  if (n % 10 === 3) return 'rd'
  return 'th'
}

const CREST_SIZE = {
  lg: 'size-[46px] text-[12px]',
  md: 'size-[34px] text-[11px]',
  sm: 'size-[28px] text-[10px]',
  xs: 'size-[22px] text-[9px]',
} as const

export type CrestSize = keyof typeof CREST_SIZE

// Team emblem. Renders the real crest image (`logoUrl`, from the API) and
// falls back to a country-code circle while loading or if the image fails.
export function Crest({
  team,
  size = 'sm',
}: {
  team: Team | null
  size?: CrestSize
}) {
  const code = teamCode(team)
  const [broken, setBroken] = useState(false)
  const showImg = Boolean(team?.logoUrl) && !broken

  return (
    <span
      className={cn(
        'relative grid place-items-center overflow-hidden rounded-full bg-raised border border-hair-strong shrink-0',
        CREST_SIZE[size],
      )}
    >
      {showImg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={team!.logoUrl!}
          alt={code}
          loading="lazy"
          onError={() => setBroken(true)}
          className="size-full object-contain p-[2px]"
        />
      ) : (
        <span className="font-mono font-extrabold tracking-[0.04em] text-foreground">
          {code}
        </span>
      )}
    </span>
  )
}

export function BoosterPill({ booster }: { booster: Booster }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded-[6px] px-2 py-[3px] font-display text-[13px] font-black leading-none tracking-[0.02em]',
        BOOSTER_PILL[booster],
      )}
    >
      <Zap className="size-[11px] fill-current" />
      {'×'}
      {booster.slice(1)}
    </span>
  )
}
