// Eksakt — sync-fixtures
//
// One-shot fixture importer. Pulls every match for a given competition
// from football-data.org v4 and upserts into our `competitions`, `teams`,
// `rounds`, and `matches` tables. Idempotent — re-run any time to refresh
// kickoff times and roster changes.
//
// Invocation:
//   POST /functions/v1/sync-fixtures
//   Body: { "code": "WC" }   — football-data.org competition code
//   Header: Authorization: Bearer <SERVICE_ROLE_KEY>
//
// Run manually after creating the comp row, or schedule daily via pg_cron
// to catch fixture rescheduling.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import {
  createFootballApiClient,
  formatLiveMinute,
  mapStatus,
  type FootballApiMatch,
  type FootballApiTeam,
} from '../_shared/football-api.ts'
import { deriveRound, type CompetitionType } from '../_shared/rounds.ts'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { code } = (await req.json().catch(() => ({}))) as { code?: string }
    if (!code) {
      return json({ error: 'Missing required field: code' }, 400)
    }

    const supabaseUrl = required('SUPABASE_URL')
    const serviceKey = required('SUPABASE_SERVICE_ROLE_KEY')
    const apiKey = required('FOOTBALL_DATA_API_KEY')

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    })
    const football = createFootballApiClient(apiKey)

    // 1. Find the competition row in our DB. We require it pre-exists —
    //    creating it is a manual one-time step (different competitions have
    //    different scoring rules, branding, etc.).
    const { data: competition, error: compErr } = await supabase
      .from('competitions')
      .select('id, type')
      .eq('code', code)
      .single()
    if (compErr || !competition) {
      return json({ error: `Competition not found in DB for code=${code}` }, 404)
    }

    // 2. Pull the full match list from football-data.org.
    const apiMatches = await football.getCompetitionMatches(code)

    // 3. Upsert teams (every unique homeTeam + awayTeam).
    const teamUpserts = collectTeams(apiMatches)
    if (teamUpserts.length > 0) {
      const { error: teamErr } = await supabase
        .from('teams')
        .upsert(teamUpserts, { onConflict: 'api_external_id' })
      if (teamErr) throw new Error(`teams upsert failed: ${teamErr.message}`)
    }

    // 4. Upsert rounds (one per unique stage / matchday in the response).
    const roundDescriptors = collectRounds(
      apiMatches,
      competition.type as CompetitionType,
    )
    const roundIdByName = new Map<string, string>()
    for (const desc of roundDescriptors) {
      const { data: round, error: roundErr } = await supabase
        .from('rounds')
        .upsert(
          {
            competition_id: competition.id,
            name: desc.name,
            sort_order: desc.sortOrder,
          },
          { onConflict: 'competition_id,name' },
        )
        .select('id, name')
        .single()
      if (roundErr || !round) {
        throw new Error(`round upsert failed for ${desc.name}: ${roundErr?.message}`)
      }
      roundIdByName.set(desc.name, round.id)
    }

    // 5. Re-fetch teams to get our internal UUIDs.
    const { data: dbTeams, error: teamLookupErr } = await supabase
      .from('teams')
      .select('id, api_external_id')
    if (teamLookupErr) throw new Error(teamLookupErr.message)
    const teamIdByExternal = new Map<number, string>()
    for (const t of dbTeams ?? []) {
      if (t.api_external_id != null) {
        teamIdByExternal.set(t.api_external_id, t.id as string)
      }
    }

    // 6. Upsert matches.
    let upserted = 0
    for (const m of apiMatches) {
      const round = deriveRound(
        competition.type as CompetitionType,
        m.stage,
        m.matchday,
      )
      const roundId = roundIdByName.get(round.name)
      if (!roundId) {
        console.warn(`No round id for ${round.name} on match ${m.id}, skipping`)
        continue
      }
      const homeTeamId =
        m.homeTeam.id != null ? teamIdByExternal.get(m.homeTeam.id) ?? null : null
      const awayTeamId =
        m.awayTeam.id != null ? teamIdByExternal.get(m.awayTeam.id) ?? null : null

      // Predictions in this app are always judged on the 90' (regulation)
      // result. Prefer `regularTime` (locked 90' for ET matches); fall
      // back to `fullTime` which IS the 90' value for matches decided in
      // regulation.
      const regHome = m.score.regularTime?.home ?? m.score.fullTime.home
      const regAway = m.score.regularTime?.away ?? m.score.fullTime.away
      const { error: matchErr } = await supabase
        .from('matches')
        .upsert(
          {
            competition_id: competition.id,
            round_id: roundId,
            home_team_id: homeTeamId,
            away_team_id: awayTeamId,
            kickoff_time: m.utcDate,
            status: mapStatus(m.status),
            home_score: regHome,
            away_score: regAway,
            matchday: m.matchday,
            live_minute: formatLiveMinute(m),
            api_external_id: m.id,
          },
          { onConflict: 'api_external_id' },
        )
      if (matchErr) {
        console.error(`match ${m.id} upsert failed: ${matchErr.message}`)
        continue
      }
      upserted++
    }

    return json({
      ok: true,
      code,
      teamsUpserted: teamUpserts.length,
      roundsUpserted: roundDescriptors.length,
      matchesUpserted: upserted,
      matchesTotal: apiMatches.length,
    })
  } catch (err) {
    console.error(err)
    return json({ error: (err as Error).message }, 500)
  }
})

// ── Helpers ──────────────────────────────────────────────────────────────────

function collectTeams(matches: FootballApiMatch[]) {
  const seen = new Map<number, FootballApiTeam>()
  for (const m of matches) {
    if (m.homeTeam.id != null) {
      seen.set(m.homeTeam.id, m.homeTeam as FootballApiTeam)
    }
    if (m.awayTeam.id != null) {
      seen.set(m.awayTeam.id, m.awayTeam as FootballApiTeam)
    }
  }
  return Array.from(seen.values()).map((t) => ({
    name: t.name ?? `Team ${t.id}`,
    short_name: t.shortName ?? t.tla ?? t.name?.slice(0, 3) ?? 'TBD',
    logo_url: t.crest ?? null,
    country_code: t.tla ?? '??',
    api_external_id: t.id,
  }))
}

function collectRounds(matches: FootballApiMatch[], type: CompetitionType) {
  const seen = new Map<string, { name: string; sortOrder: number }>()
  for (const m of matches) {
    const r = deriveRound(type, m.stage, m.matchday)
    seen.set(r.name, r)
  }
  return Array.from(seen.values())
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
