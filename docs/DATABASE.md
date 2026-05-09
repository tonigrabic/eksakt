# Database Schema

All tables use Supabase Postgres with Row Level Security (RLS). The
canonical source of truth is the SQL in `supabase/migrations/`; this doc
mirrors it for human reading. If they disagree, the migration wins —
update this doc.

## Tables

### profiles
Extends Supabase `auth.users`. Created automatically on signup via the
`handle_new_user` trigger (pulls `display_name` from
`raw_user_meta_data → display_name|name`, falling back to the email's
local-part).

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK, references `auth.users(id)` ON DELETE CASCADE |
| display_name | text | NOT NULL |
| avatar_url | text | nullable |
| created_at | timestamptz | default `now()` |
| updated_at | timestamptz | default `now()`, maintained by trigger |

### teams
Football teams / national squads.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK, default `gen_random_uuid()` |
| name | text | NOT NULL — "Croatia" |
| short_name | text | NOT NULL — "CRO" |
| logo_url | text | nullable |
| country_code | text | NOT NULL — ISO "HR" |
| api_external_id | integer | UNIQUE, nullable — football-data.org team ID |
| created_at | timestamptz | default `now()` |

### competitions

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| name | text | NOT NULL — "FIFA World Cup 2026" |
| code | text | NOT NULL UNIQUE — "WC" (matches football-data.org) |
| type | text | NOT NULL CHECK in (`'CUP'`, `'LEAGUE'`) |
| emblem_url | text | nullable |
| api_external_id | integer | UNIQUE, nullable — football-data.org comp ID |
| season_start | date | NOT NULL |
| season_end | date | NOT NULL — used to detect "completed" leagues |
| created_at | timestamptz | default `now()` |

### rounds
Stages within a competition.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| competition_id | uuid | FK → competitions ON DELETE CASCADE |
| name | text | NOT NULL — "Group Stage", "Round of 16" |
| sort_order | integer | NOT NULL — for display ordering |
| created_at | timestamptz | default `now()` |

UNIQUE on `(competition_id, name)`.

### matches
Individual football matches.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| competition_id | uuid | FK → competitions ON DELETE CASCADE |
| round_id | uuid | FK → rounds ON DELETE RESTRICT |
| home_team_id | uuid | FK → teams, nullable (TBD knockout) |
| away_team_id | uuid | FK → teams, nullable (TBD knockout) |
| kickoff_time | timestamptz | NOT NULL — drives blind-prediction RLS |
| status | text | NOT NULL default `'scheduled'`, CHECK in (`'scheduled'`, `'live'`, `'finished'`) |
| home_score | integer | nullable until finished, CHECK ≥ 0 |
| away_score | integer | nullable until finished, CHECK ≥ 0 |
| matchday | integer | nullable, for league play |
| live_minute | text | nullable — `"67'"`, `"45+2'"`, `"HT"` (only when `status='live'`) |
| api_external_id | integer | UNIQUE, nullable — football-data.org match ID |
| created_at | timestamptz | default `now()` |
| updated_at | timestamptz | default `now()`, maintained by trigger |

### leagues
User-created prediction leagues. A league no longer points at a single
competition — see `league_competitions` for the many-to-many.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| name | text | NOT NULL, length 1-80 |
| description | text | nullable |
| invite_code | text | NOT NULL UNIQUE, length 4-12 |
| icon | text | nullable — emoji or short label, falls back to trophy in UI |
| created_by | uuid | FK → profiles ON DELETE RESTRICT |
| settings | jsonb | NOT NULL default — see shape below |
| created_at | timestamptz | default `now()` |

**`settings` JSONB shape:**
```json
{
  "boosters": {
    "enabled": true,
    "pool": { "x2": 3, "x3": 1, "x5": 1 }
  }
}
```
The flat-object pool shape matches `BoosterCounts` in `src/types`. Indexed
JSON paths (e.g. `settings -> 'boosters' -> 'enabled'`) work without
contortions.

### league_competitions
Many-to-many: which real-world competitions a league auto-follows. New
matches synced into a linked competition automatically flow into the
league. Each link carries a `start_date` cutoff so matches kicking off
before that timestamp are excluded — fair to mid-season joiners.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| league_id | uuid | FK → leagues ON DELETE CASCADE |
| competition_id | uuid | FK → competitions ON DELETE RESTRICT |
| start_date | timestamptz | NOT NULL, default `now()` |
| added_by | uuid | FK → profiles ON DELETE SET NULL, nullable |
| added_at | timestamptz | default `now()` |

UNIQUE on `(league_id, competition_id)`.

### league_matches
Explicit, hand-picked matches. Reserved for the future "quick league" UI
(a single-night league cherry-picking matches across competitions). Empty
in v1 — the table is here so adding the wizard later requires no
migration.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| league_id | uuid | FK → leagues ON DELETE CASCADE |
| match_id | uuid | FK → matches ON DELETE CASCADE |
| added_by | uuid | FK → profiles ON DELETE SET NULL, nullable |
| added_at | timestamptz | default `now()` |

UNIQUE on `(league_id, match_id)`.

### league_members
Many-to-many: users in leagues.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| league_id | uuid | FK → leagues ON DELETE CASCADE |
| user_id | uuid | FK → profiles ON DELETE CASCADE |
| role | text | NOT NULL default `'member'`, CHECK in (`'admin'`, `'member'`) |
| joined_at | timestamptz | default `now()` |

UNIQUE on `(league_id, user_id)`.

### predictions
User score predictions. One per user per match per league.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| user_id | uuid | FK → profiles ON DELETE CASCADE |
| match_id | uuid | FK → matches ON DELETE CASCADE |
| league_id | uuid | FK → leagues ON DELETE CASCADE |
| home_score | integer | NOT NULL, CHECK 0-20 |
| away_score | integer | NOT NULL, CHECK 0-20 |
| booster | text | nullable, CHECK in (`'x2'`, `'x3'`, `'x5'`) |
| created_at | timestamptz | default `now()` |
| updated_at | timestamptz | default `now()`, maintained by trigger |

UNIQUE on `(user_id, match_id, league_id)`.

### points
Final points per prediction. Inserted by the `compute_points` trigger
(or Edge Function) when the linked match transitions to `status='finished'`.
**Live points are computed on read, not stored** — they would be
invalidated as soon as the next goal goes in.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| prediction_id | uuid | FK → predictions ON DELETE CASCADE, UNIQUE |
| base_points | integer | NOT NULL CHECK in (0, 1, 4) |
| outcome_bonus | integer | NOT NULL CHECK in (0, 1, 3) — rarity bonus |
| exact_bonus | integer | NOT NULL CHECK in (0, 1, 3) — rarity bonus |
| booster_multiplier | integer | NOT NULL CHECK in (1, 2, 3, 5) |
| total | integer | NOT NULL — `(base + outcome_bonus + exact_bonus) * multiplier` |
| created_at | timestamptz | default `now()` |

## Indexes

Beyond the implicit indexes on PKs and UNIQUE constraints:

| Table | Index |
|---|---|
| teams | `(api_external_id)` |
| competitions | `(season_end)` |
| rounds | `(competition_id)` |
| matches | `(competition_id)`, `(kickoff_time)`, `(status)` |
| leagues | `(created_by)` |
| league_competitions | `(league_id)`, `(competition_id)` |
| league_matches | `(league_id)` |
| league_members | `(league_id)`, `(user_id)` |
| predictions | `(match_id, league_id)`, `(user_id)` |

## Functions

### Helper functions (used by RLS)
- `is_league_member(p_league_id uuid) returns boolean` — `SECURITY DEFINER`,
  bypasses RLS to check membership. Required to avoid recursive policies
  on `league_members`.
- `match_has_kicked_off(p_match_id uuid) returns boolean` — `SECURITY DEFINER`,
  used by predictions RLS to enforce blind predictions.
- `league_match_ids(p_league_id uuid) returns table(match_id uuid)` —
  `SECURITY DEFINER`, returns the union of "matches in linked
  competitions from start_date onward" + "explicit league_matches picks".
  Single chokepoint for "what matches belong to a league?". Used by both
  the predictions INSERT policy and the `get_league_matches` RPC.
- `get_league_matches(p_league_id uuid) returns setof matches` —
  `SECURITY DEFINER` convenience wrapper that returns the actual match
  rows so PostgREST can chain `.select(...)` for join embeds.

### Trigger functions
- `handle_new_user()` — fires on `auth.users` INSERT, creates the matching
  `profiles` row.
- `touch_updated_at()` — generic `updated_at` maintainer; bound to
  `profiles`, `matches`, `predictions`.
- `compute_points()` _(future, in 00006 migration)_ — fires on `matches`
  AFTER UPDATE when `status` transitions to `'finished'`; computes rarity
  + base + bonuses for every prediction on that match and inserts into
  `points`.

## RLS Policies

| Table | Policy | Effect |
|---|---|---|
| profiles | SELECT all | readable by anyone signed in or not |
| profiles | UPDATE self | `auth.uid() = id` |
| teams | SELECT all | public read |
| competitions | SELECT all | public read |
| rounds | SELECT all | public read |
| matches | SELECT all | public read |
| leagues | SELECT member | only league members (or creator, defensive) |
| leagues | INSERT authed | `auth.uid() = created_by` |
| leagues | UPDATE admin | only league admins |
| league_competitions | SELECT member | only league members |
| league_competitions | INSERT admin | only league admins |
| league_competitions | DELETE admin | only league admins (no UI in v1) |
| league_matches | SELECT member | only league members |
| league_matches | INSERT admin | only league admins |
| league_matches | DELETE admin | only league admins |
| league_members | SELECT member | members can see other members |
| league_members | INSERT self | `auth.uid() = user_id` (join) |
| league_members | DELETE self | `auth.uid() = user_id` (leave) |
| predictions | SELECT own | always |
| predictions | SELECT post-kickoff | other members' picks visible after kickoff |
| predictions | INSERT pre-kickoff | own pick, before `kickoff_time`, AND match in `league_match_ids(league_id)` |
| predictions | UPDATE pre-kickoff | own pick, before `kickoff_time` |
| points | SELECT member | visible to league members |

Mutations on reference data (`teams`, `competitions`, `rounds`, `matches`)
and on `points` happen only via the service role — through Edge Functions
running fixture/livescore syncs and the points-computation trigger. No
end-user policies for these.

`predictions` has no DELETE policy by design — edits use UPDATE so we keep
the audit trail.

## Entity Relationships

```
profiles 1──M league_members M──1 leagues
                                    │
                                    │ 1──M league_competitions M──1 competitions ──M rounds ──M matches
                                    │                                                              │   │
                                    │ 1──M league_matches      M──1 matches                  home_team away_team
                                    │                                                              │   │
profiles 1──M predictions                                                                       teams ─┘

predictions 1──1 points
predictions M──1 matches
predictions M──1 leagues
predictions M──1 profiles
```

A league's effective match set is the UNION of:
- every match in `league_competitions` whose `kickoff_time >= start_date`
- every match listed in `league_matches`

Use the `league_match_ids(league_id)` function to compute it; never
reimplement.
