-- Eksakt — daily prediction reminders
--
-- Sends each user one email ~1 hour before a slate of matches kicks off,
-- listing the games in that slate they haven't predicted yet. Mirrors the
-- sync-* jobs: pg_cron tick → SQL gate → dispatch_edge_function → the
-- `send-prediction-reminders` Edge Function does the actual emailing
-- (via Resend).
--
-- ── What counts as "a slate"? ───────────────────────────────────────────────
--
-- We deliberately do NOT key off rounds/matchdays. A World Cup CUP round
-- is a whole stage ("Group Stage") that spans ~2 weeks, so one reminder
-- per round would fire once and never again. League matchdays are finer
-- but European fixtures still straddle midnight (evening kickoffs + 1am
-- games belong together).
--
-- Instead a "session" is a time cluster: the next upcoming match starts a
-- session, and every scheduled match within SESSION_WINDOW (12h) of that
-- start belongs to it. We fire ~1h before the session's first kickoff and
-- the email lists every still-open (scheduled, future) match in the window
-- the user hasn't picked. So evening + small-hours games land in one
-- email; the next afternoon (>12h later) is a fresh session the next day.

-- ── Dedupe ledger ───────────────────────────────────────────────────────────

create table public.reminder_batches (
  id            uuid primary key default gen_random_uuid(),
  session_start timestamptz not null,
  session_end   timestamptz not null,
  sent_at       timestamptz not null default now()
);

create index reminder_batches_window_idx
  on public.reminder_batches (session_start, session_end);

comment on table public.reminder_batches is
  'One row per match session we have already dispatched reminders for. '
  'A new session''s first kickoff must fall outside every stored '
  '[session_start, session_end) window — that is the double-send guard.';

-- ── Gate: is a session due for a reminder right now? ─────────────────────────
--
-- Find the earliest upcoming scheduled match that belongs to some league's
-- effective set (a linked competition past its start_date, or an explicit
-- league_matches pick) and isn't already inside a reminded window. If it
-- kicks off within the next 60 minutes, a session is due: it spans
-- [that kickoff, that kickoff + 12h).

create or replace function public.session_due_for_reminder()
returns table (session_start timestamptz, session_end timestamptz)
language sql
stable
as $$
  select first_kickoff as session_start,
         first_kickoff + interval '12 hours' as session_end
  from (
    select m.kickoff_time as first_kickoff
    from public.matches m
    where m.status = 'scheduled'
      and m.kickoff_time > now()
      and (
        exists (
          select 1 from public.league_competitions lc
          where lc.competition_id = m.competition_id
            and m.kickoff_time >= lc.start_date
        )
        or exists (
          select 1 from public.league_matches lm
          where lm.match_id = m.id
        )
      )
      and not exists (
        select 1 from public.reminder_batches b
        where m.kickoff_time >= b.session_start
          and m.kickoff_time <  b.session_end
      )
    order by m.kickoff_time
    limit 1
  ) earliest
  where first_kickoff <= now() + interval '60 minutes';
$$;

-- ── Recipients: who to email, and what they're missing ──────────────────────
--
-- One row per (user, league, missing match) inside the session window.
-- The Edge Function groups these into a single email per user. SECURITY
-- DEFINER so it can read auth.users.email; honours the
-- notifications_enabled opt-out. Only members actually missing a pick
-- appear (the predictions LEFT JOIN + `pr.id is null` filter).

create or replace function public.prediction_reminder_recipients(
  p_session_start timestamptz,
  p_session_end   timestamptz
)
returns table (
  user_id      uuid,
  email        text,
  display_name text,
  league_id    uuid,
  league_name  text,
  match_id     uuid,
  home_team    text,
  away_team    text,
  kickoff_time timestamptz
)
language sql
security definer
set search_path = public, auth
as $$
  -- Each league's effective match set, via the documented chokepoint.
  -- Evaluated once per league, then joined to members below.
  with league_match as (
    select l.id as league_id, lmi.match_id
    from public.leagues l
    join lateral public.league_match_ids(l.id) lmi on true
  )
  select
    lm.user_id,
    u.email,
    pf.display_name,
    l.id   as league_id,
    l.name as league_name,
    m.id   as match_id,
    coalesce(ht.name, 'TBD') as home_team,
    coalesce(at.name, 'TBD') as away_team,
    m.kickoff_time
  from public.leagues l
  join league_match lmatch       on lmatch.league_id = l.id
  join public.matches m          on m.id = lmatch.match_id
   and m.status = 'scheduled'
   and m.kickoff_time > now()
   and m.kickoff_time >= p_session_start
   and m.kickoff_time <  p_session_end
  join public.league_members lm  on lm.league_id = l.id
  join public.profiles pf        on pf.id = lm.user_id
   and pf.notifications_enabled
  join auth.users u              on u.id = lm.user_id
   and u.email is not null
  left join public.predictions pr
    on pr.user_id = lm.user_id
   and pr.match_id = m.id
   and pr.league_id = l.id
  left join public.teams ht on ht.id = m.home_team_id
  left join public.teams at on at.id = m.away_team_id
  where pr.id is null
  order by lm.user_id, l.name, m.kickoff_time;
$$;

-- Only the service role (used by the Edge Function) may read recipients;
-- this exposes email addresses, so keep it off the public API surface.
revoke execute on function public.prediction_reminder_recipients(timestamptz, timestamptz) from public, anon, authenticated;
grant  execute on function public.prediction_reminder_recipients(timestamptz, timestamptz) to service_role;

-- ── Dispatcher: claim the due session, then fire the Edge Function ──────────

create or replace function public.dispatch_prediction_reminders()
returns integer
language plpgsql
security definer
as $$
declare
  s      record;
  v_req  bigint;
  n      integer := 0;
begin
  for s in select * from public.session_due_for_reminder() loop
    -- Claim the window first so a racing cron tick can't double-send.
    -- (At most one session is ever due at a time, but be safe.)
    insert into public.reminder_batches (session_start, session_end)
    values (s.session_start, s.session_end);

    v_req := public.dispatch_edge_function(
      'send-prediction-reminders',
      jsonb_build_object(
        'sessionStart', s.session_start,
        'sessionEnd',   s.session_end
      )
    );

    -- Vault secrets missing → dispatch was a no-op. Release the claim so
    -- a later tick (once secrets are set) can retry.
    if v_req is null then
      delete from public.reminder_batches
      where session_start = s.session_start
        and session_end = s.session_end;
      continue;
    end if;

    n := n + 1;
  end loop;
  return n;
end;
$$;

-- ── Schedule ────────────────────────────────────────────────────────────────
--
-- Every 15 min: the gate is a cheap indexed SELECT that exits immediately
-- when nothing is within the hour. A session fires on the first tick that
-- lands inside its final hour, so reminders go out 45–60 min pre-kickoff.

select cron.schedule(
  'eksakt-prediction-reminders',
  '*/15 * * * *',
  $cron$ select public.dispatch_prediction_reminders(); $cron$
);
