// Eksakt — send-prediction-reminders
//
// Emails each user who still has unpredicted games in a session (a 12h
// cluster of kickoffs) that is about to start. Dispatched by the
// `dispatch_prediction_reminders` SQL function (pg_cron) ~1 hour before
// the session's first match — see
// supabase/migrations/00020_prediction_reminders.sql.
//
// The heavy lifting (who to email, which games they're missing, honouring
// the notifications_enabled opt-out) lives in the
// `prediction_reminder_recipients` RPC. This function just groups the
// rows per user, renders the email, and sends it via Resend.
//
// Invocation:
//   POST /functions/v1/send-prediction-reminders
//   Body: { "sessionStart": "<iso>", "sessionEnd": "<iso>" }
//   Header: Authorization: Bearer <SERVICE_ROLE_KEY>
//
// Required Edge Function secrets:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  (injected by the platform)
//   RESEND_FROM      — sender address, e.g. "Eksakt <reminders@eksakt.app>"
//   APP_URL          — public app origin for the CTA link, e.g. https://eksakt.app
//
// Email transport is chosen by ../_shared/email.ts from the environment:
//   • MAILPIT_URL    — local dev; drops mail into the Supabase inbox.
//   • RESEND_API_KEY — production; sends via Resend.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { corsHeaders } from '../_shared/cors.ts'
import { emailProviderFromEnv } from '../_shared/email.ts'

type RecipientRow = {
  user_id: string
  email: string
  display_name: string
  league_id: string
  league_name: string
  match_id: string
  home_team: string
  away_team: string
  kickoff_time: string
}

type LeagueGroup = {
  leagueName: string
  matches: { home: string; away: string; kickoff: string }[]
}

type UserEmail = {
  email: string
  displayName: string
  leagues: Map<string, LeagueGroup>
  matchCount: number
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { sessionStart, sessionEnd } = (await req
      .json()
      .catch(() => ({}))) as { sessionStart?: string; sessionEnd?: string }
    if (!sessionStart || !sessionEnd) {
      return json(
        { error: 'Missing required fields: sessionStart, sessionEnd' },
        400,
      )
    }

    const supabaseUrl = required('SUPABASE_URL')
    const serviceKey = required('SUPABASE_SERVICE_ROLE_KEY')
    const from =
      Deno.env.get('RESEND_FROM') ?? 'Eksakt <reminders@eksakt.app>'
    const appUrl = Deno.env.get('APP_URL') ?? ''

    // Strategy: Mailpit locally, Resend in production — picked from env.
    const email = emailProviderFromEnv()

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    })

    const { data: rows, error } = await supabase.rpc(
      'prediction_reminder_recipients',
      { p_session_start: sessionStart, p_session_end: sessionEnd },
    )
    if (error) throw new Error(`recipients RPC failed: ${error.message}`)

    const recipients = groupByUser((rows ?? []) as RecipientRow[])
    if (recipients.size === 0) {
      return json({ ok: true, sessionStart, sessionEnd, recipients: 0, sent: 0 })
    }

    // Capture one reference time so every "in N hours" in this batch is
    // computed against the same instant.
    const now = new Date()
    let sent = 0
    let failed = 0
    for (const user of recipients.values()) {
      try {
        await email.send({
          from,
          to: user.email,
          subject: subjectFor(user),
          html: renderEmail(user, appUrl, now),
        })
        sent++
      } catch (err) {
        failed++
        console.error(`reminder to ${user.email} failed: ${(err as Error).message}`)
      }
    }

    return json({
      ok: true,
      sessionStart,
      sessionEnd,
      recipients: recipients.size,
      sent,
      failed,
    })
  } catch (err) {
    console.error(err)
    return json({ error: (err as Error).message }, 500)
  }
})

// ── Grouping ─────────────────────────────────────────────────────────────────

function groupByUser(rows: RecipientRow[]): Map<string, UserEmail> {
  const users = new Map<string, UserEmail>()
  for (const row of rows) {
    let user = users.get(row.user_id)
    if (!user) {
      user = {
        email: row.email,
        displayName: row.display_name,
        leagues: new Map(),
        matchCount: 0,
      }
      users.set(row.user_id, user)
    }
    let league = user.leagues.get(row.league_id)
    if (!league) {
      league = { leagueName: row.league_name, matches: [] }
      user.leagues.set(row.league_id, league)
    }
    league.matches.push({
      home: row.home_team,
      away: row.away_team,
      kickoff: row.kickoff_time,
    })
    user.matchCount++
  }
  return users
}

// ── Email content ────────────────────────────────────────────────────────────

function subjectFor(user: UserEmail): string {
  const n = user.matchCount
  return n === 1
    ? '⚽ 1 match closing soon — get your Eksakt pick in'
    : `⚽ ${n} matches closing soon — get your Eksakt picks in`
}

function renderEmail(user: UserEmail, appUrl: string, now: Date): string {
  const leagueBlocks = Array.from(user.leagues.values())
    .map((league) => {
      const rows = league.matches
        .map(
          (m) => `
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid #f0f0f1;font-size:15px;color:#18181b;">
                ${escapeHtml(m.home)} <span style="color:#a1a1aa;">vs</span> ${escapeHtml(m.away)}
              </td>
              <td style="padding:10px 0;border-bottom:1px solid #f0f0f1;font-size:13px;color:#71717a;text-align:right;white-space:nowrap;">
                ${formatKickoff(m.kickoff, now)}
              </td>
            </tr>`,
        )
        .join('')
      return `
        <div style="margin:0 0 8px 0;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:#71717a;">
          ${escapeHtml(league.leagueName)}
        </div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px 0;">
          ${rows}
        </table>`
    })
    .join('')

  const cta = appUrl
    ? `<tr>
         <td style="padding:8px 32px 0 32px;text-align:center;">
           <a href="${escapeAttr(appUrl)}" style="display:inline-block;padding:12px 24px;background:#18181b;color:#ffffff;text-decoration:none;border-radius:10px;font-size:15px;font-weight:600;">
             Make your predictions
           </a>
         </td>
       </tr>`
    : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Get your Eksakt predictions in</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#18181b;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f4f5;padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
          <tr>
            <td style="padding:32px 32px 8px 32px;text-align:center;">
              <div style="display:inline-block;font-size:24px;font-weight:700;letter-spacing:-0.02em;color:#18181b;">Eksakt</div>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 32px 0 32px;text-align:center;">
              <h1 style="margin:16px 0 8px 0;font-size:22px;line-height:1.3;font-weight:600;color:#18181b;">Kickoff in about an hour</h1>
              <p style="margin:0;font-size:15px;line-height:1.5;color:#52525b;">${escapeHtml(firstName(user.displayName))}, you still have open games. Lock in your scores before they kick off.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px 0 32px;">
              ${leagueBlocks}
            </td>
          </tr>
          ${cta}
          <tr>
            <td style="padding:32px;text-align:center;">
              <p style="margin:0;font-size:12px;line-height:1.5;color:#a1a1aa;">You're getting this because email reminders are on. Turn them off any time from your profile in the Eksakt app.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatKickoff(iso: string, now: Date): string {
  // Relative, not absolute: we don't know the recipient's timezone, so
  // "in 3 hours" is meaningful everywhere where "20:00 UTC" is not. These
  // reminders are read promptly, so the slight staleness as the email ages
  // is an acceptable trade for being timezone-free.
  const mins = Math.round((new Date(iso).getTime() - now.getTime()) / 60000)
  if (mins <= 1) return 'kicking off now'
  if (mins < 60) return `in ${roundTo(mins, 5)} min`
  const hours = Math.round(mins / 60)
  return hours === 1 ? 'in about 1 hour' : `in about ${hours} hours`
}

function roundTo(n: number, step: number): number {
  return Math.max(step, Math.round(n / step) * step)
}

function firstName(displayName: string): string {
  return displayName.trim().split(/\s+/)[0] || 'Hey'
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/'/g, '&#39;')
}

function required(name: string): string {
  const v = Deno.env.get(name)
  if (!v) throw new Error(`Missing required env var: ${name}`)
  return v
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}
