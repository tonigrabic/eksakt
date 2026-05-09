-- Eksakt — multi-competition leagues.
--
-- A league no longer points at a single competition. Instead it has:
--   • league_competitions — "follow this comp"; new fixtures synced into
--     the comp auto-flow into the league. Each row carries a start_date
--     so matches kicking off before that timestamp are excluded (fair to
--     mid-season joiners — they don't compete against history).
--   • league_matches — explicit match picks. Reserved for the future
--     "quick league" UI (cherry-pick matches across comps for a single
--     night). Empty in v1; the schema is here so adding the wizard later
--     requires no migration.
--
-- A league's effective match set = UNION of (matches in linked comps from
-- start_date onward) + (any explicitly picked matches). The function
-- public.league_match_ids(uuid) is the single chokepoint — every query
-- (and the predictions INSERT RLS) goes through it. Keep it that way.

-- ── New tables ──────────────────────────────────────────────────────────────

create table public.league_competitions (
  id              uuid primary key default gen_random_uuid(),
  league_id       uuid not null references public.leagues(id) on delete cascade,
  competition_id  uuid not null references public.competitions(id) on delete restrict,
  -- Cutoff for auto-included matches. Matches with kickoff_time < start_date
  -- are excluded from this league. Defaults to "now" so a league created
  -- mid-season starts clean.
  start_date      timestamptz not null default now(),
  added_by        uuid references public.profiles(id) on delete set null,
  added_at        timestamptz not null default now(),
  unique (league_id, competition_id)
);

create index league_competitions_league_id_idx
  on public.league_competitions (league_id);
create index league_competitions_competition_id_idx
  on public.league_competitions (competition_id);

create table public.league_matches (
  id          uuid primary key default gen_random_uuid(),
  league_id   uuid not null references public.leagues(id) on delete cascade,
  match_id    uuid not null references public.matches(id) on delete cascade,
  added_by    uuid references public.profiles(id) on delete set null,
  added_at    timestamptz not null default now(),
  unique (league_id, match_id)
);

create index league_matches_league_id_idx on public.league_matches (league_id);

comment on table public.league_competitions is
  'Many-to-many between leagues and real competitions. Auto-includes every match in the linked competition kicking off on/after start_date.';
comment on table public.league_matches is
  'Explicit hand-picked matches. Empty in v1; reserved for future quick-league UI.';

-- ── Backfill from existing single-comp leagues ─────────────────────────────
--
-- Preserve current behavior: every existing league becomes linked to its
-- one competition, with start_date = league.created_at so all historical
-- matches still belong to it. New leagues created post-migration will use
-- the default (now()) instead — fair to late starters.

insert into public.league_competitions
  (league_id, competition_id, start_date, added_by, added_at)
select
  id,
  competition_id,
  created_at,
  created_by,
  created_at
from public.leagues;

-- ── Effective-match-set chokepoint ─────────────────────────────────────────
--
-- SECURITY DEFINER mirrors is_league_member. Required so RLS policies can
-- call this without recursing into league_competitions / league_matches RLS.

create or replace function public.league_match_ids(p_league_id uuid)
returns table(match_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select m.id
  from public.matches m
  join public.league_competitions lc on lc.competition_id = m.competition_id
  where lc.league_id = p_league_id
    and m.kickoff_time >= lc.start_date
  union
  select m.id
  from public.matches m
  join public.league_matches lm on lm.match_id = m.id
  where lm.league_id = p_league_id;
$$;

-- Convenience: returns the matches themselves for client-side fetches.
-- PostgREST treats `setof matches` as a queryable resource, so callers can
-- chain `.select(...)` to embed teams/round joins exactly like a normal
-- table query.
create or replace function public.get_league_matches(p_league_id uuid)
returns setof public.matches
language sql
stable
security definer
set search_path = public
as $$
  select m.*
  from public.matches m
  where m.id in (select match_id from public.league_match_ids(p_league_id));
$$;

-- ── Drop old single-comp column ────────────────────────────────────────────

drop index if exists public.leagues_competition_id_idx;
alter table public.leagues drop column competition_id;

-- ── RLS for the new tables ─────────────────────────────────────────────────

alter table public.league_competitions enable row level security;
alter table public.league_matches      enable row level security;

-- League members can see what their league is linked to. Non-members see
-- nothing — same visibility rule as `leagues`.
create policy league_competitions_select_member on public.league_competitions
  for select using (public.is_league_member(league_id));

-- Only league admins can attach a new competition. Per product spec,
-- comps can be added but not removed; we still install a delete policy
-- for admins as a safety valve (e.g., misclicks during a beta).
create policy league_competitions_insert_admin on public.league_competitions
  for insert with check (
    exists (
      select 1 from public.league_members
      where league_id = league_competitions.league_id
        and user_id  = auth.uid()
        and role     = 'admin'
    )
  );

create policy league_competitions_delete_admin on public.league_competitions
  for delete using (
    exists (
      select 1 from public.league_members
      where league_id = league_competitions.league_id
        and user_id  = auth.uid()
        and role     = 'admin'
    )
  );

-- league_matches: identical visibility / write rules.
create policy league_matches_select_member on public.league_matches
  for select using (public.is_league_member(league_id));

create policy league_matches_insert_admin on public.league_matches
  for insert with check (
    exists (
      select 1 from public.league_members
      where league_id = league_matches.league_id
        and user_id  = auth.uid()
        and role     = 'admin'
    )
  );

create policy league_matches_delete_admin on public.league_matches
  for delete using (
    exists (
      select 1 from public.league_members
      where league_id = league_matches.league_id
        and user_id  = auth.uid()
        and role     = 'admin'
    )
  );

-- ── Tighten predictions INSERT to the effective match set ──────────────────
--
-- Pre-migration this was implicit: a league had one competition and
-- predictions joined naturally. After dropping leagues.competition_id
-- nothing stopped a member from POSTing a prediction for any match into
-- any of their leagues. We now require the match to be in the league's
-- effective match set (linked comp, post-start_date, OR explicit pick).

drop policy if exists predictions_insert_self_pre_kickoff on public.predictions;

create policy predictions_insert_self_pre_kickoff on public.predictions
  for insert with check (
    auth.uid() = user_id
    and public.is_league_member(league_id)
    and exists (
      select 1 from public.matches
      where id = match_id and kickoff_time > now()
    )
    and exists (
      select 1 from public.league_match_ids(league_id) lm
      where lm.match_id = predictions.match_id
    )
  );

-- UPDATE policy doesn't need the same check: an existing prediction's
-- (league_id, match_id) was vetted on insert, and league_competitions
-- can't be removed in v1 — so the effective set only ever grows.
