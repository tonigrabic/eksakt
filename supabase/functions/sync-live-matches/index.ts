// Eksakt — sync-live-matches
//
// Hot-path poller. Pulls all matches in a small time window (yesterday →
// tomorrow) for a given competition, then UPDATEs only those whose state
// has changed: score, live_minute, status. Run every 30s during match
// windows by pg_cron.
//
// We do NOT touch teams or rounds here — that's sync-fixtures' job.
// We do NOT insert new matches here — fixtures should already exist.
// Stale or unknown api_external_id values are skipped, not errored.
//
// When a match transitions to status='finished', the on_match_status_changed
// trigger automatically runs compute_points_for_match(), inserting into
// the `points` table. No further work needed here for that case.
//
// Invocation:
//   POST /functions/v1/sync-live-matches
//   Body: { "code": "WC" }
//   Header: Authorization: Bearer <SERVICE_ROLE_KEY>

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  createFootballApiClient,
  formatLiveMinute,
  mapStatus,
} from "../_shared/football-api.ts";
import { corsHeaders } from "../_shared/cors.ts";

const DAY_MS = 24 * 60 * 60 * 1000;

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { code } = (await req.json().catch(() => ({}))) as { code?: string };
    if (!code) return json({ error: "Missing required field: code" }, 400);

    const supabaseUrl = required("SUPABASE_URL");
    const serviceKey = required("SUPABASE_SERVICE_ROLE_KEY");
    const apiKey = required("FOOTBALL_DATA_API_KEY");

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });
    const football = createFootballApiClient(apiKey);

    const now = Date.now();
    const dateFrom = isoDate(now - DAY_MS);
    const dateTo = isoDate(now + DAY_MS);
    const apiMatches = await football.getCompetitionMatches(code, {
      dateFrom,
      dateTo,
    });

    let updated = 0;
    let unchanged = 0;
    const transitions: Array<{ id: number; from: string; to: string }> = [];

    for (const m of apiMatches) {
      const newStatus = mapStatus(m.status);
      const newHome = m.score.fullTime.home;
      const newAway = m.score.fullTime.away;
      const newMinute = formatLiveMinute(m);

      // Read existing row so we can no-op when nothing changed (saves
      // wear on Postgres + reduces Realtime broadcast noise).
      const { data: existing, error: readErr } = await supabase
        .from("matches")
        .select("id, status, home_score, away_score, live_minute")
        .eq("api_external_id", m.id)
        .maybeSingle();
      if (readErr) {
        console.error(`read failed for ${m.id}: ${readErr.message}`);
        continue;
      }
      if (!existing) continue; // fixtures haven't been imported yet

      const same =
        existing.status === newStatus &&
        existing.home_score === newHome &&
        existing.away_score === newAway &&
        existing.live_minute === newMinute;
      if (same) {
        unchanged++;
        continue;
      }

      const { error: updErr } = await supabase
        .from("matches")
        .update({
          status: newStatus,
          home_score: newHome,
          away_score: newAway,
          live_minute: newMinute,
        })
        .eq("id", existing.id);
      if (updErr) {
        console.error(`update failed for ${m.id}: ${updErr.message}`);
        continue;
      }
      updated++;
      if (existing.status !== newStatus) {
        transitions.push({ id: m.id, from: existing.status, to: newStatus });
      }
    }

    return json({
      ok: true,
      code,
      considered: apiMatches.length,
      updated,
      unchanged,
      transitions,
    });
  } catch (err) {
    console.error(err);
    return json({ error: (err as Error).message }, 500);
  }
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function isoDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function required(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}
