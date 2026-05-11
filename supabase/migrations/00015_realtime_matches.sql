-- Eksakt — Realtime broadcast for live match score changes.
--
-- Supabase's `supabase_realtime` publication doesn't include user tables
-- by default. Add `matches` so the sync-live-matches edge function's
-- UPDATEs (status / score / minute) push to subscribed clients and the
-- live match screen reflects them without polling.
--
-- We intentionally do NOT add `predictions` — picks are locked at
-- kickoff, so a live match's prediction set is stable; live points are
-- recomputed in JS from the score, which already flows via `matches`.

alter publication supabase_realtime add table public.matches;
