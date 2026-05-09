-- Eksakt — broaden the smart-gate so missed matches get caught up.
--
-- Original window for scheduled matches: [kickoff − 15min, kickoff + 5min].
-- Tight enough to catch the live transition, but if pg_cron pauses (e.g.
-- the dev machine sleeps mid-afternoon) and the match finishes during the
-- gap, the smart-gate returns false on resume and we never sync the
-- result.
--
-- Fix: extend the back edge of the scheduled-window from -15min to -3h.
-- A match's kickoff being up to 3 hours ago AND still 'scheduled' in our
-- DB is a strong signal the API knows something we don't (most likely
-- 'finished'). 3 hours covers a 90-min match + halftime + ample stoppage
-- + extra time + buffer. Beyond that, the daily fixture sync catches it.
--
-- Live matches are still polled regardless of how long they've been live.

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
        -- Window covers both the pre-kickoff lead-in (so we catch the
        -- live transition) and the post-kickoff recovery zone (so we
        -- pick up results we missed during cron downtime).
        or (
          m.status = 'scheduled'
          and m.kickoff_time between (now() - interval '3 hours')
                                 and (now() + interval '5 minutes')
        )
      )
  );
$$;
