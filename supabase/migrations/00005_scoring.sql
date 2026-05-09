-- Eksakt — scoring engine in SQL.
--
-- This is the SQL counterpart of src/lib/scoring.ts. Both implementations
-- must stay in sync — the TS version powers the live "Best for You"
-- suggestion and the live points displayed on the dashboard, while this
-- SQL version computes the final, persisted points written to the `points`
-- table when a match transitions to status='finished'.
--
-- The TS implementation is the human-readable spec. If you change the
-- rules, change both files together — and add a test case if possible.

-- ── Booster multiplier ──────────────────────────────────────────────────────

create or replace function public.booster_multiplier(p_booster text)
returns integer
language sql
immutable
as $$
  select case p_booster
    when 'x2' then 2
    when 'x3' then 3
    when 'x5' then 5
    else 1
  end;
$$;

-- ── Rarity-tier helper ──────────────────────────────────────────────────────
--
-- < 5%  → +3 (rare contrarian pick)
-- 5-15% → +1 (uncommon)
-- > 15% → 0  (common, no bonus)
--
-- Inputs are counts to avoid float comparison issues at the 5% / 15% cliffs.

create or replace function public.rarity_bonus(
  p_matching_count integer,
  p_total_count integer
)
returns integer
language plpgsql
immutable
as $$
declare
  pct numeric;
begin
  if p_total_count = 0 then
    return 0;
  end if;
  pct := (p_matching_count::numeric / p_total_count) * 100;
  if pct < 5 then
    return 3;
  elsif pct <= 15 then
    return 1;
  else
    return 0;
  end if;
end;
$$;

-- ── Compute & persist points for one finished match ─────────────────────────
--
-- Idempotent: re-running for the same match overwrites existing point rows
-- via ON CONFLICT, so the trigger is safe against retries.
--
-- For each prediction on the match (across all leagues), we compute:
--   • base       — 4 if exact, 1 if correct outcome, 0 otherwise
--   • outcome    — rarity bonus among same-league peers who picked the
--                  same outcome (only if our outcome was correct)
--   • exact      — rarity bonus among same-league peers who picked the
--                  same exact score (only if we got the exact score)
--   • multiplier — from booster
--   • total      — (base + outcome + exact) * multiplier
--
-- Rarity is calculated per-league because predictions are scoped per-league;
-- a contrarian pick in your office league is independent of one in your
-- Balkan-Boys league.

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

  -- Pre-compute peer counts per (league_id, my_outcome) and (league_id, exact score).
  -- These CTEs are the core of the rarity bonus.
  insert into public.points (
    prediction_id, base_points, outcome_bonus, exact_bonus,
    booster_multiplier, total
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
  league_totals as (
    select league_id, count(*)::integer as total
    from my_picks
    group by league_id
  ),
  scored as (
    select
      mp.prediction_id,
      mp.league_id,
      mp.booster,
      mp.is_exact,
      mp.is_correct_outcome,
      lt.total as league_total,
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
    join league_totals lt on lt.league_id = mp.league_id
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
        then public.rarity_bonus(s.same_outcome_count, s.league_total)
      else 0
    end as outcome_bonus,
    case
      when s.is_exact
        then public.rarity_bonus(s.same_exact_count, s.league_total)
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
          then public.rarity_bonus(s.same_outcome_count, s.league_total)
        else 0
      end)
      + (case
        when s.is_exact
          then public.rarity_bonus(s.same_exact_count, s.league_total)
        else 0
      end)
    ) * public.booster_multiplier(s.booster) as total
  from scored s
  on conflict (prediction_id) do update
    set base_points        = excluded.base_points,
        outcome_bonus      = excluded.outcome_bonus,
        exact_bonus        = excluded.exact_bonus,
        booster_multiplier = excluded.booster_multiplier,
        total              = excluded.total;
end;
$$;
