-- Eksakt — inclusive rarity rule + audit columns on points.
--
-- TWO related changes:
--
-- 1. Rarity denominator switched from "predictors" to "league members".
--    The Croatian spec says "% of players predicted X". We had been
--    counting only members who actually submitted a pick — too generous
--    on big leagues with low engagement (a contrarian bonus was easy
--    when only 2 friends bothered to predict). Members who didn't
--    predict still count toward the denominator now; non-prediction
--    is treated as "wrong outcome" implicitly (they don't get a row
--    in `points`, no scoring side-effect).
--
-- 2. Audit columns on `points` so any score can be explained without
--    re-deriving from raw data:
--      • member_count       — denominator at compute time
--      • same_outcome_count — peers (incl. non-predictors filtered out)
--                             with same W/D/L
--      • same_exact_count   — peers with same exact score
--      • outcome_pct        — same_outcome_count / member_count * 100
--      • exact_pct          — same_exact_count / member_count * 100
--    These let the UI show a "why these points?" breakdown later, and
--    survive even if league membership changes after the fact.
--
-- Existing finished matches are recomputed at the bottom of this
-- migration so the persisted points reflect the new rule. The function
-- is idempotent (ON CONFLICT DO UPDATE), so re-running it on already-
-- scored matches just rewrites the rows.

-- ── 1. Audit columns ────────────────────────────────────────────────────────

alter table public.points
  add column if not exists same_outcome_count integer not null default 0,
  add column if not exists same_exact_count   integer not null default 0,
  add column if not exists member_count       integer not null default 0,
  add column if not exists outcome_pct        numeric(5, 2) not null default 0,
  add column if not exists exact_pct          numeric(5, 2) not null default 0;

-- ── 2. Replace compute_points_for_match ─────────────────────────────────────

create or replace function public.compute_points_for_match(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_home integer;
  v_away integer;
  v_status text;
begin
  select home_score, away_score, status
  into v_home, v_away, v_status
  from public.matches
  where id = p_match_id;

  if v_status is distinct from 'finished' then
    raise exception 'compute_points_for_match called on non-finished match %', p_match_id;
  end if;
  if v_home is null or v_away is null then
    raise exception 'match % is finished but scores are null', p_match_id;
  end if;

  insert into public.points (
    prediction_id, base_points, outcome_bonus, exact_bonus,
    booster_multiplier, total,
    same_outcome_count, same_exact_count, member_count,
    outcome_pct, exact_pct
  )
  with my_picks as (
    select
      p.id           as prediction_id,
      p.league_id,
      p.home_score,
      p.away_score,
      p.booster,
      sign(p.home_score - p.away_score) as my_outcome,
      (p.home_score = v_home and p.away_score = v_away) as is_exact,
      (sign(p.home_score - p.away_score) = sign(v_home - v_away)) as is_correct_outcome
    from public.predictions p
    where p.match_id = p_match_id
  ),
  -- Member counts are the new denominator. Counted per league across
  -- all of its members, not just those who predicted this match.
  member_counts as (
    select lm.league_id, count(*)::integer as total
    from public.league_members lm
    where lm.league_id in (select distinct league_id from my_picks)
    group by lm.league_id
  ),
  scored as (
    select
      mp.prediction_id,
      mp.league_id,
      mp.booster,
      mp.is_exact,
      mp.is_correct_outcome,
      mc.total as member_count,
      (
        select count(*)::integer from my_picks peer
        where peer.league_id = mp.league_id
          and sign(peer.home_score - peer.away_score) = mp.my_outcome
      ) as same_outcome_count,
      (
        select count(*)::integer from my_picks peer
        where peer.league_id = mp.league_id
          and peer.home_score = mp.home_score
          and peer.away_score = mp.away_score
      ) as same_exact_count
    from my_picks mp
    join member_counts mc on mc.league_id = mp.league_id
  )
  select
    s.prediction_id,
    case
      when s.is_exact then 4
      when s.is_correct_outcome then 1
      else 0
    end as base_points,
    case
      when s.is_correct_outcome
        then public.rarity_bonus(s.same_outcome_count, s.member_count)
      else 0
    end as outcome_bonus,
    case
      when s.is_exact
        then public.rarity_bonus(s.same_exact_count, s.member_count)
      else 0
    end as exact_bonus,
    public.booster_multiplier(s.booster) as booster_multiplier,
    (
      (case
        when s.is_exact then 4
        when s.is_correct_outcome then 1
        else 0
      end)
      + (case
        when s.is_correct_outcome
          then public.rarity_bonus(s.same_outcome_count, s.member_count)
        else 0
      end)
      + (case
        when s.is_exact
          then public.rarity_bonus(s.same_exact_count, s.member_count)
        else 0
      end)
    ) * public.booster_multiplier(s.booster) as total,
    s.same_outcome_count,
    s.same_exact_count,
    s.member_count,
    case
      when s.member_count = 0 then 0
      else round(s.same_outcome_count::numeric / s.member_count::numeric * 100, 2)
    end as outcome_pct,
    case
      when s.member_count = 0 then 0
      else round(s.same_exact_count::numeric / s.member_count::numeric * 100, 2)
    end as exact_pct
  from scored s
  on conflict (prediction_id) do update
    set base_points        = excluded.base_points,
        outcome_bonus      = excluded.outcome_bonus,
        exact_bonus        = excluded.exact_bonus,
        booster_multiplier = excluded.booster_multiplier,
        total              = excluded.total,
        same_outcome_count = excluded.same_outcome_count,
        same_exact_count   = excluded.same_exact_count,
        member_count       = excluded.member_count,
        outcome_pct        = excluded.outcome_pct,
        exact_pct          = excluded.exact_pct;
end;
$$;

-- ── 3. Recompute every already-finished match ──────────────────────────────
--
-- ON CONFLICT DO UPDATE ensures this is safe to run multiple times.

do $$
declare
  m record;
begin
  for m in select id from public.matches where status = 'finished' loop
    perform public.compute_points_for_match(m.id);
  end loop;
end $$;
