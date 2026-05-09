-- Eksakt — pg_cron schedule for sync jobs.
--
-- Two recurring jobs per active competition:
--   • sync-fixtures: daily at 03:00 UTC. Refreshes kickoff times and
--     reschedules. Light-weight read of the full match list.
--   • sync-live-matches: every 30s, but smart-gated. The dispatcher
--     function checks whether the competition has an in-flight or
--     imminent match before firing the HTTP call to the Edge Function.
--     During quiet periods the cron tick just runs a SELECT and exits.
--
-- Secrets (Supabase project URL + service role key) are read from Vault.
-- See docs/SETUP.md for the one-time Vault initialisation step. Without
-- those secrets set, dispatcher calls will warn and return without doing
-- network I/O.

-- ── Smart gate: do we need to poll right now? ───────────────────────────────

create or replace function public.should_poll_live_matches(p_competition_code text)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.matches m
    join public.competitions c on c.id = m.competition_id
    where c.code = p_competition_code
      and (
        m.status = 'live'
        -- Pre-kickoff window: poll starting 5 min before until 15 min after
        -- the scheduled kickoff so we never miss the live transition due
        -- to clock skew between us and football-data.org.
        or (
          m.status = 'scheduled'
          and m.kickoff_time between (now() - interval '15 minutes')
                                 and (now() + interval '5 minutes')
        )
      )
  );
$$;

-- ── Vault secret access helper ──────────────────────────────────────────────

create or replace function public._eksakt_secret(p_name text)
returns text
language plpgsql
security definer
set search_path = vault, public
as $$
declare
  v text;
begin
  select decrypted_secret
  into v
  from vault.decrypted_secrets
  where name = p_name
  limit 1;
  return v;
end;
$$;

-- ── Dispatcher: HTTP-POST to an Edge Function ───────────────────────────────

create or replace function public.dispatch_edge_function(
  p_function_name text,
  p_body jsonb
)
returns bigint
language plpgsql
security definer
as $$
declare
  v_url text;
  v_key text;
  v_request_id bigint;
begin
  v_url := public._eksakt_secret('supabase_url');
  v_key := public._eksakt_secret('service_role_key');

  if v_url is null or v_key is null then
    raise warning 'eksakt: vault secrets supabase_url or service_role_key not set; skipping %',
      p_function_name;
    return null;
  end if;

  select net.http_post(
    url := v_url || '/functions/v1/' || p_function_name,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body := p_body,
    timeout_milliseconds := 10000
  )
  into v_request_id;

  return v_request_id;
end;
$$;

-- ── Per-competition dispatchers ─────────────────────────────────────────────

create or replace function public.dispatch_sync_live_matches(p_code text)
returns bigint
language plpgsql
as $$
begin
  if not public.should_poll_live_matches(p_code) then
    return null; -- no live or imminent match; don't waste an API call
  end if;
  return public.dispatch_edge_function(
    'sync-live-matches',
    jsonb_build_object('code', p_code)
  );
end;
$$;

create or replace function public.dispatch_sync_fixtures(p_code text)
returns bigint
language plpgsql
as $$
begin
  return public.dispatch_edge_function(
    'sync-fixtures',
    jsonb_build_object('code', p_code)
  );
end;
$$;

-- ── Schedules ───────────────────────────────────────────────────────────────
--
-- World Cup 2026 ('WC') is the launch competition. Add more competitions
-- by appending cron.schedule rows here in a future migration.

select cron.schedule(
  'eksakt-sync-live-wc',
  '30 seconds',
  $cron$ select public.dispatch_sync_live_matches('WC'); $cron$
);

select cron.schedule(
  'eksakt-sync-fixtures-wc',
  '0 3 * * *',
  $cron$ select public.dispatch_sync_fixtures('WC'); $cron$
);
