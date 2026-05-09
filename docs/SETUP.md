# Eksakt — Setup

One-time setup for local development. After this you can `npm run dev`
and have a real Supabase + Edge Functions stack running locally.

## Prerequisites

- Node 20+
- Docker (running) — Supabase local stack runs in containers
- Supabase CLI: `brew install supabase/tap/supabase`
- A football-data.org API key (Livescores plan — €12/mo) — sign up at
  https://www.football-data.org

## 1. Local Supabase

From the project root:

```bash
supabase start
```

This boots Postgres, Auth, Realtime, Storage, Edge Runtime, and the Studio
UI in Docker. First run takes a few minutes to pull images. The CLI prints
the local URLs and keys you'll need; copy them into `.env.local`:

```bash
cp .env.example .env.local
# Fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
# SUPABASE_SERVICE_ROLE_KEY from the `supabase start` output.
```

Migrations in `supabase/migrations/` are applied automatically on `start`.
If you change a migration, run `supabase db reset` to wipe + re-apply.

## 2. Edge Function secrets

The football-data.org API key is read by Edge Functions, not Next.js, so
it goes into Supabase secrets:

```bash
supabase secrets set FOOTBALL_DATA_API_KEY=<your-key>
```

Then serve the functions locally:

```bash
supabase functions serve --env-file .env.local
```

## 3. pg_cron Vault secrets

The cron jobs in `00007_cron.sql` dispatch HTTP calls to Edge Functions,
reading the project URL + service role key from the database Vault. Set
them once per environment:

```sql
-- Run in Supabase Studio's SQL editor, or via `supabase db connect`.

select vault.create_secret(
  'http://kong:8000',                         -- value (local: kong gateway URL)
  'supabase_url',                             -- name
  'eksakt: Supabase URL used by pg_cron dispatchers'  -- description
);

select vault.create_secret(
  '<your-service-role-key>',
  'service_role_key',
  'eksakt: service role key used by pg_cron dispatchers'
);
```

For production, the URL is `https://<project-ref>.supabase.co` and the
key is the production service role key from the dashboard.

If these secrets are not set, the cron jobs run but skip the network call
with a warning — useful so the dev environment doesn't error out before
you've configured everything.

## 4. Bootstrap the World Cup competition

We don't auto-create competition rows; pick what you want to track and
insert it manually so you control branding and scoring rules per comp.

```sql
insert into public.competitions (
  name, code, type, season_start, season_end, api_external_id
) values (
  'FIFA World Cup 2026',
  'WC',
  'CUP',
  '2026-06-11',
  '2026-07-19',
  2000   -- football-data.org competition ID for World Cup
);
```

Then trigger the first fixtures import:

```bash
curl -X POST http://localhost:54321/functions/v1/sync-fixtures \
  -H "Authorization: Bearer $(supabase secrets list | grep SERVICE_ROLE_KEY | awk '{print $2}')" \
  -H "Content-Type: application/json" \
  -d '{"code":"WC"}'
```

Or from the SQL editor:

```sql
select public.dispatch_sync_fixtures('WC');
```

## 5. Run the app

```bash
npm install
npm run dev
```

Visit http://localhost:3000.

## Verifying the pipeline

Manual triggers for sanity checks:

```sql
-- Should return true if there's a live or imminent WC match.
select public.should_poll_live_matches('WC');

-- Force one poll.
select public.dispatch_sync_live_matches('WC');

-- Inspect cron jobs.
select * from cron.job;

-- See recent cron run results.
select * from cron.job_run_details order by start_time desc limit 20;
```

When a real match transitions to `status='finished'`, the
`on_match_status_changed` trigger fires `compute_points_for_match` and
populates the `points` table. To verify:

```sql
select prediction_id, base_points, outcome_bonus, exact_bonus,
       booster_multiplier, total
from public.points
order by created_at desc
limit 20;
```

## Production deploy

```bash
supabase link --project-ref <ref>
supabase db push                         # applies all migrations
supabase functions deploy sync-fixtures
supabase functions deploy sync-live-matches
supabase secrets set FOOTBALL_DATA_API_KEY=<prod-key>
# Then set Vault secrets via SQL editor on the prod project.
```
