'use client'

import { useEffect, useState } from 'react'
import { displayLiveMinute } from '@/lib/format'
import type { MatchStatus, ISODateTime } from '@/types'

/**
 * Returns the display string for a match's live minute (e.g. "67'",
 * "45+2'", "HT"), ticking on its own every 30s so the wall-clock
 * fallback in `displayLiveMinute` doesn't go stale between refetches.
 *
 * Accepts nullable inputs so callers can invoke it before the match
 * data has loaded — required to keep hook order stable across renders
 * (no conditional hooks). Returns null when inputs are incomplete.
 *
 * Ticks on a 30s cadence (not 1s) because the displayed minute is
 * integer-resolution; sub-minute updates would just re-render the
 * same string.
 */
export function useLiveMinute(
  liveMinute: string | null | undefined,
  status: MatchStatus | undefined,
  kickoffTime: ISODateTime | undefined,
): string | null {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (status !== 'live') return
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [status])

  if (!status || !kickoffTime) return null
  return displayLiveMinute(liveMinute ?? null, status, kickoffTime, now)
}
