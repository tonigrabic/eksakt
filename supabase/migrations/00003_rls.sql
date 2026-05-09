-- Eksakt — Row-Level Security
--
-- Visibility rules in plain English:
--   • Public reference data (teams, competitions, rounds, matches): readable
--     by anyone signed in or not. Only the service role can mutate — match
--     scores/status come from football-data.org sync jobs, not user actions.
--   • Profiles: readable by anyone (so display names render in standings).
--     Each user can update only their own row.
--   • Leagues / league_members / points: scoped to league members.
--   • Predictions:
--       – You can always see your own.
--       – You can see other members' predictions ONLY after the match has
--         kicked off (kickoff_time <= now()). Pre-kickoff = blind.
--       – You can insert/update your own ONLY before kickoff_time.
--       – No one can DELETE predictions; we keep the audit trail. Edits
--         use UPDATE.
--
-- Self-referential policies on join tables (league_members) cause infinite
-- recursion under standard policies. We use SECURITY DEFINER helper
-- functions to break the cycle — they bypass RLS within their own body.

-- ── Helper functions ────────────────────────────────────────────────────────

create or replace function public.is_league_member(p_league_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.league_members
    where league_id = p_league_id and user_id = auth.uid()
  );
$$;

create or replace function public.match_has_kicked_off(p_match_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.matches
    where id = p_match_id and kickoff_time <= now()
  );
$$;

-- ── Enable RLS on every table ───────────────────────────────────────────────

alter table public.profiles        enable row level security;
alter table public.teams           enable row level security;
alter table public.competitions    enable row level security;
alter table public.rounds          enable row level security;
alter table public.matches         enable row level security;
alter table public.leagues         enable row level security;
alter table public.league_members  enable row level security;
alter table public.predictions     enable row level security;
alter table public.points          enable row level security;

-- ── Public reference data: readable by anyone ───────────────────────────────

create policy teams_select_all on public.teams
  for select using (true);

create policy competitions_select_all on public.competitions
  for select using (true);

create policy rounds_select_all on public.rounds
  for select using (true);

create policy matches_select_all on public.matches
  for select using (true);

-- No INSERT/UPDATE/DELETE policies for these — only the service role
-- (which bypasses RLS entirely) can mutate via the football-data.org sync.

-- ── Profiles: readable by anyone, writable by self ──────────────────────────

create policy profiles_select_all on public.profiles
  for select using (true);

create policy profiles_update_self on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- INSERT happens via the on_auth_user_created trigger; users do not
-- insert profiles directly.

-- ── Leagues: members only ───────────────────────────────────────────────────

create policy leagues_select_member on public.leagues
  for select using (public.is_league_member(id));

create policy leagues_insert_authenticated on public.leagues
  for insert with check (auth.uid() = created_by);

create policy leagues_update_admin on public.leagues
  for update using (
    exists (
      select 1 from public.league_members
      where league_id = leagues.id
        and user_id = auth.uid()
        and role = 'admin'
    )
  );

-- No DELETE for leagues — admins can hide via a future archived flag.

-- ── League members ──────────────────────────────────────────────────────────

create policy league_members_select_member on public.league_members
  for select using (public.is_league_member(league_id));

-- Joining: the user inserts themselves. Invite-code validation will
-- happen in the application layer (RPC) which checks the code matches a
-- league before calling INSERT.
create policy league_members_insert_self on public.league_members
  for insert with check (auth.uid() = user_id);

-- Leaving: a member can remove themselves. Admins can remove anyone in
-- their league via a future RPC.
create policy league_members_delete_self on public.league_members
  for delete using (auth.uid() = user_id);

-- ── Predictions ─────────────────────────────────────────────────────────────

-- SELECT: own picks always visible.
create policy predictions_select_own on public.predictions
  for select using (auth.uid() = user_id);

-- SELECT: others' picks visible only AFTER kickoff, and only if you're in
-- the same league.
create policy predictions_select_post_kickoff on public.predictions
  for select using (
    public.is_league_member(league_id)
    and public.match_has_kicked_off(match_id)
  );

-- INSERT: your own pick, before kickoff, in a league you're a member of.
create policy predictions_insert_self_pre_kickoff on public.predictions
  for insert with check (
    auth.uid() = user_id
    and public.is_league_member(league_id)
    and exists (
      select 1 from public.matches
      where id = match_id and kickoff_time > now()
    )
  );

-- UPDATE: your own pick, still before kickoff.
create policy predictions_update_self_pre_kickoff on public.predictions
  for update
  using (
    auth.uid() = user_id
    and exists (
      select 1 from public.matches
      where id = match_id and kickoff_time > now()
    )
  )
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.matches
      where id = match_id and kickoff_time > now()
    )
  );

-- No DELETE policy — predictions are append/edit only. Match deletion
-- will cascade-delete via the FK if a match is ever removed.

-- ── Points: visible to league members only ─────────────────────────────────

create policy points_select_member on public.points
  for select using (
    exists (
      select 1
      from public.predictions p
      where p.id = points.prediction_id
        and public.is_league_member(p.league_id)
    )
  );

-- INSERT/UPDATE/DELETE on points happens only via the service role
-- (Edge Function that runs after match completion). No user policies.
