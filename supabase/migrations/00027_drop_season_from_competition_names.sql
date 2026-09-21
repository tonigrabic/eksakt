-- Eksakt — competition names no longer carry the season.
--
-- Problem: competitions.name baked the season into the label ("Premier
-- League 2025/26"), but roll_competition_season() (00023) only advances
-- season_start / season_end when football-data.org rolls a competition to
-- its next season. After the 2026/27 rollover every league row therefore
-- had 2026/27 dates and a 2025/26 name, and the league-creation picker
-- (CompetitionPicker) showed users the wrong season.
--
-- Fix: the name is the competition's stable identity ("Premier League");
-- the season is a property of the row's season_start / season_end and is
-- derived by the UI (competitionSeasonLabel in src/lib/format.ts). Nothing
-- has to rewrite the name at rollover, and the invariant can't drift again.
--
-- One-off tournaments keep the year in their name ("FIFA World Cup 2026")
-- because the year IS the identity there — WC 2030 is a different
-- competition row. The strip below only matches a trailing "YYYY/YY"
-- season, so a plain trailing year is untouched.
--
-- Data fix: strips the suffix from every affected row — the six European
-- competitions seeded at launch and "HNL 2026/27" (PRVA, 00026) if that
-- migration ran first. Idempotent: rows without the suffix don't match.

update public.competitions
set name = regexp_replace(name, '\s+\d{4}/\d{2}$', '')
where name ~ '\s+\d{4}/\d{2}$';

comment on column public.competitions.name is
  'Stable display name without a season suffix ("Premier League"). The current season lives in season_start / season_end and is rendered by the UI. One-off tournaments may carry their year ("FIFA World Cup 2026").';
