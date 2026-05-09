// UI formatting helpers. Pure — no React. Tested implicitly via screens.

import type { ISODateTime, MatchStatus } from '@/types'

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

// Day label used by the upcoming-matches grouping. Returns short, all-caps
// strings: "TODAY", "TOMORROW", "WED 14 MAY", or "14 MAY" beyond a week.
export function formatDayLabel(date: Date, now: number = Date.now()): string {
  const startToday = new Date(now)
  startToday.setHours(0, 0, 0, 0)
  const startTarget = new Date(date)
  startTarget.setHours(0, 0, 0, 0)
  const dayDiff = Math.round(
    (startTarget.getTime() - startToday.getTime()) / DAY,
  )
  if (dayDiff === 0) return 'TODAY'
  if (dayDiff === 1) return 'TOMORROW'
  if (dayDiff > 1 && dayDiff < 7) {
    return startTarget
      .toLocaleDateString(undefined, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      })
      .toUpperCase()
  }
  return startTarget
    .toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
    .toUpperCase()
}

// Stable per-day key derived from local Y-M-D, used by bucketing.
export function localDayKey(iso: ISODateTime): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

// Render the live-minute badge for a match.
//
// Preference order:
//   1. The DB's `live_minute` if set (from sync-live-matches: "HT" for
//      paused matches, or the actual minute on a paid tier that returns
//      it). Always trusted — most accurate signal we can get.
//   2. For in-play matches without that data (football-data.org's free
//      tier returns `minute: null` for everything), we approximate from
//      kickoff_time using a fixed model:
//        • 1st half:  0' – 45'         → elapsed
//        • 1st-half stoppage: 45+1'..45+5' → elapsed-45 added
//        • Halftime window: ~5 min ambiguity around the break → "HT"
//        • 2nd half:  46' – 90'        → elapsed minus 15-min halftime
//        • 2nd-half stoppage: 90+1'..  → cap at 90+
//      Drift vs. reality: ±2 min worst case (halftime length varies,
//      stoppage time is unknowable from free tier). When upgrading to
//      Livescores the DB starts getting populated `live_minute` and
//      this fallback never runs.
//   3. status not 'live' → null (renderer shows nothing).

// Wall-clock model assumptions for the fallback.
//
//   wall 0 .. 45       → 1st half regulation             (minutes 1'..45')
//   wall 45 .. 50      → 1st half stoppage              (45+1 .. 45+5)
//   wall 50 .. 65      → halftime (assumed 15 min)      ("HT")
//   wall 65 .. 110     → 2nd half regulation             (46' .. 90')
//   wall 110+          → 2nd half stoppage               (90+1, 90+2, …)
//
// Match-minute formula for the 2nd half:
//   match_minute = wall_elapsed − SECOND_HALF_OFFSET
//   where SECOND_HALF_OFFSET = wall_at_2H_kickoff − 46 = 65 − 46 = 19
//
// So at wall 65: 65 − 19 = 46' (correct, just into 2nd half).
//
// Drift vs. reality: ±2 min — halftime length varies (10–20 min in
// practice), and 1st-half stoppage isn't fixed. The PAUSED-status →
// "HT" signal from the API is more accurate; this fallback only runs
// when API hasn't surfaced that yet, or when minute is unavailable
// (free tier always).

const HALFTIME_BREAK_MIN = 15
const FIRST_HALF_REGULATION = 45
const FIRST_HALF_STOPPAGE_CAP = 5
const HT_START = FIRST_HALF_REGULATION + FIRST_HALF_STOPPAGE_CAP // wall 50
const SECOND_HALF_START = HT_START + HALFTIME_BREAK_MIN // wall 65
const SECOND_HALF_KICKOFF_MINUTE = 46
const SECOND_HALF_OFFSET = SECOND_HALF_START - SECOND_HALF_KICKOFF_MINUTE // 19

export function displayLiveMinute(
  liveMinute: string | null,
  status: MatchStatus,
  kickoffTime: ISODateTime,
  now: number = Date.now(),
): string | null {
  if (liveMinute) return liveMinute
  if (status !== 'live') return null

  const elapsed = (now - new Date(kickoffTime).getTime()) / MIN
  if (elapsed <= 0) return null

  // 1st half regulation.
  if (elapsed <= FIRST_HALF_REGULATION) return `${Math.floor(elapsed)}'`

  // 1st half stoppage (45+1 .. 45+5).
  const firstHalfStoppage = elapsed - FIRST_HALF_REGULATION
  if (firstHalfStoppage <= FIRST_HALF_STOPPAGE_CAP) {
    return `${FIRST_HALF_REGULATION}+${Math.ceil(firstHalfStoppage)}'`
  }

  // Halftime window (wall 50–65). API's PAUSED status is the
  // authoritative source — this branch only fires when API still says
  // IN_PLAY but our wall-clock thinks HT (typical for stale free-tier
  // responses).
  if (elapsed < SECOND_HALF_START) return 'HT'

  // 2nd half regulation.
  const matchMinute = Math.floor(elapsed - SECOND_HALF_OFFSET)
  if (matchMinute <= 90) return `${matchMinute}'`
  return `90+${matchMinute - 90}'`
}
