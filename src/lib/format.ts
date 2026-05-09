// UI formatting helpers. Pure — no React. Tested implicitly via screens.

import type { ISODateTime } from '@/types'

const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

// Render a kickoff time as a relative-friendly string for the upcoming list.
//   < 24h:  "2h 15m"
//   today:  "Today 18:00"
//   tomorrow: "Tomorrow 18:00"
//   < 1w:   "Sat 15:00"
//   else:   "12 Jun 18:00"
export function formatKickoff(iso: ISODateTime, now: number = Date.now()): string {
  const t = new Date(iso).getTime()
  const diff = t - now
  if (diff < 0) return 'Started'

  const date = new Date(iso)
  const hh = date.getHours().toString().padStart(2, '0')
  const mm = date.getMinutes().toString().padStart(2, '0')
  const time = `${hh}:${mm}`

  if (diff < 24 * HOUR) {
    const hrs = Math.floor(diff / HOUR)
    const mins = Math.floor((diff % HOUR) / MIN)
    if (hrs > 0) return `${hrs}h ${mins}m`
    return `${mins}m`
  }

  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const target = new Date(date)
  target.setHours(0, 0, 0, 0)
  const dayDiff = Math.round((target.getTime() - today.getTime()) / DAY)

  if (dayDiff === 1) return `Tomorrow ${time}`
  if (dayDiff < 7) {
    const weekday = date.toLocaleDateString(undefined, { weekday: 'short' })
    return `${weekday} ${time}`
  }
  const month = date.toLocaleDateString(undefined, { month: 'short' })
  return `${date.getDate()} ${month} ${time}`
}

// "1st", "2nd", "3rd", "4th", ...
export function positionLabel(pos: number): string {
  if (pos === 1) return '1st'
  if (pos === 2) return '2nd'
  if (pos === 3) return '3rd'
  return `${pos}th`
}

// Format a prediction tuple as "1-2" / "+5".
export function formatScore(home: number, away: number): string {
  return `${home}-${away}`
}

// Color tier for points displays. Mirrors the sample threshold rules.
export function pointsTier(pts: number): 'high' | 'mid' | 'low' | 'zero' {
  if (pts >= 7) return 'high'
  if (pts >= 4) return 'mid'
  if (pts >= 1) return 'low'
  return 'zero'
}
