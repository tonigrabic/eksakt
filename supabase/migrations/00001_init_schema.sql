-- Eksakt — initial schema
--
-- Mirrors docs/DATABASE.md and src/types/index.ts. Every table here
-- corresponds to a domain entity used by the UI; payload-shaped types
-- (LeagueDashboardSummary, etc.) are derived in queries, not stored.

-- ── Profiles ────────────────────────────────────────────────────────────────

create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text not null,
  avatar_url    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ── Football entities ───────────────────────────────────────────────────────

create table public.teams (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  short_name      text not null,
  logo_url        text,
  country_code    text not null,
  api_external_id integer unique,
  created_at      timestamptz not null default now()
);

create index teams_api_external_id_idx on public.teams (api_external_id);

create table public.competitions (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  code            text not null unique,
  type            text not null check (type in ('CUP', 'LEAGUE')),
  emblem_url      text,
  api_external_id integer unique,
  season_start    date not null,
  season_end      date not null,
  created_at      timestamptz not null default now()
);

create index competitions_season_end_idx on public.competitions (season_end);

create table public.rounds (
  id              uuid primary key default gen_random_uuid(),
  competition_id  uuid not null references public.competitions(id) on delete cascade,
  name            text not null,
  sort_order      integer not null,
  created_at      timestamptz not null default now(),
  unique (competition_id, name)
);

create index rounds_competition_id_idx on public.rounds (competition_id);

create table public.matches (
  id              uuid primary key default gen_random_uuid(),
  competition_id  uuid not null references public.competitions(id) on delete cascade,
  round_id        uuid not null references public.rounds(id) on delete restrict,
  home_team_id    uuid references public.teams(id) on delete restrict,
  away_team_id    uuid references public.teams(id) on delete restrict,
  kickoff_time    timestamptz not null,
  status          text not null default 'scheduled'
                  check (status in ('scheduled', 'live', 'finished')),
  home_score      integer check (home_score is null or home_score >= 0),
  away_score      integer check (away_score is null or away_score >= 0),
  matchday        integer,
  live_minute     text,
  api_external_id integer unique,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index matches_competition_id_idx on public.matches (competition_id);
create index matches_kickoff_time_idx   on public.matches (kickoff_time);
create index matches_status_idx         on public.matches (status);

-- ── Leagues ─────────────────────────────────────────────────────────────────

create table public.leagues (
  id              uuid primary key default gen_random_uuid(),
  name            text not null check (length(name) between 1 and 80),
  description     text,
  invite_code     text not null unique check (length(invite_code) between 4 and 12),
  icon            text,                  -- emoji or short label; nullable
  competition_id  uuid not null references public.competitions(id) on delete restrict,
  created_by      uuid not null references public.profiles(id) on delete restrict,
  -- settings JSON shape (see docs/DATABASE.md):
  -- { "boosters": { "enabled": bool, "pool": { "x2": int, "x3": int, "x5": int } } }
  settings        jsonb not null default '{
    "boosters": {
      "enabled": true,
      "pool": { "x2": 3, "x3": 1, "x5": 1 }
    }
  }'::jsonb,
  created_at      timestamptz not null default now()
);

create index leagues_competition_id_idx on public.leagues (competition_id);
create index leagues_created_by_idx     on public.leagues (created_by);

create table public.league_members (
  id          uuid primary key default gen_random_uuid(),
  league_id   uuid not null references public.leagues(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  role        text not null default 'member' check (role in ('admin', 'member')),
  joined_at   timestamptz not null default now(),
  unique (league_id, user_id)
);

create index league_members_user_id_idx   on public.league_members (user_id);
create index league_members_league_id_idx on public.league_members (league_id);

-- ── Predictions & Points ────────────────────────────────────────────────────

create table public.predictions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  match_id    uuid not null references public.matches(id) on delete cascade,
  league_id   uuid not null references public.leagues(id) on delete cascade,
  home_score  integer not null check (home_score between 0 and 20),
  away_score  integer not null check (away_score between 0 and 20),
  booster     text check (booster in ('x2', 'x3', 'x5')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, match_id, league_id)
);

create index predictions_match_id_league_id_idx
  on public.predictions (match_id, league_id);
create index predictions_user_id_idx
  on public.predictions (user_id);

create table public.points (
  id                  uuid primary key default gen_random_uuid(),
  prediction_id       uuid not null unique references public.predictions(id) on delete cascade,
  base_points         integer not null check (base_points in (0, 1, 4)),
  outcome_bonus       integer not null check (outcome_bonus in (0, 1, 3)),
  exact_bonus         integer not null check (exact_bonus in (0, 1, 3)),
  booster_multiplier  integer not null check (booster_multiplier in (1, 2, 3, 5)),
  total               integer not null,
  created_at          timestamptz not null default now()
);

-- ── Comments for future readers ─────────────────────────────────────────────

comment on table public.predictions is
  'One pick per (user, match, league). RLS hides others'' picks until kickoff.';
comment on table public.points is
  'Computed by Edge Function after match.status flips to ''finished''. Live points are computed on read, not stored.';
comment on column public.leagues.settings is
  'JSON: { boosters: { enabled: bool, pool: { x2: int, x3: int, x5: int } } }';
