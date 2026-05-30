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

    // Status is a monotonic state machine: scheduled → live → finished.
    // football-data.org's free tier sometimes returns stale "TIMED/SCHEDULED"
    // views (CDN cache) for matches that have already kicked off, causing
    // a live match to flip back to scheduled. Real-world matches don't
    // un-start, so we refuse to regress.
    const STATUS_RANK: Record<string, number> = {
      scheduled: 0,
      live: 1,
      finished: 2,
    };

    let updated = 0;
    let unchanged = 0;
    let regressionsSkipped = 0;
    const transitions: Array<{ id: number; from: string; to: string }> = [];

    for (const m of apiMatches) {
      const apiStatus = mapStatus(m.status);
      // Predictions are scored on the 90' (regulation) result, never
      // post-ET. For matches that went to ET/penalties, `regularTime`
      // holds the locked 90' score; for everything else, `fullTime` IS
      // the 90' result.
      const inOvertime = m.score.duration !== "REGULAR";
      const reg = m.score.regularTime;
      const apiHome = reg?.home ?? m.score.fullTime.home;
      const apiAway = reg?.away ?? m.score.fullTime.away;
      // Defensive: if we're in ET and the API isn't exposing
      // `regularTime` (free tier sometimes hides it), DO NOT overwrite
      // the stored score with `fullTime` — it now includes ET goals.
      // Preserve whatever 90' score we already captured.
      const canUpdateScore = !inOvertime || reg != null;
      const apiMinute = formatLiveMinute(m);

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

      // If the API says the match is in an "earlier" state than what we
      // already have, ignore the entire row — including scores. The score
      // in a regression payload is unreliable (often null or 0-0).
      const isRegression =
        STATUS_RANK[apiStatus] < STATUS_RANK[existing.status];
      if (isRegression) {
        regressionsSkipped++;
        continue;
      }

      // Build the patch defensively: never write nulls back over real data
      // (free tier sometimes returns null scores even on IN_PLAY).
      const patch: Record<string, unknown> = {};
      if (apiStatus !== existing.status) patch.status = apiStatus;
      if (
        canUpdateScore &&
        apiHome !== null &&
        apiHome !== existing.home_score
      ) {
        patch.home_score = apiHome;
      }
      if (
        canUpdateScore &&
        apiAway !== null &&
        apiAway !== existing.away_score
      ) {
        patch.away_score = apiAway;
      }
      if (apiMinute !== existing.live_minute) patch.live_minute = apiMinute;

      if (Object.keys(patch).length === 0) {
        unchanged++;
        continue;
      }

      const { error: updErr } = await supabase
        .from("matches")
        .update(patch)
        .eq("id", existing.id);
      if (updErr) {
        console.error(`update failed for ${m.id}: ${updErr.message}`);
        continue;
      }
      updated++;
      if (patch.status && existing.status !== patch.status) {
        transitions.push({
          id: m.id,
          from: existing.status,
          to: apiStatus,
        });
      }
    }

    return json({
      ok: true,
      code,
      considered: apiMatches.length,
      updated,
      unchanged,
      regressionsSkipped,
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
