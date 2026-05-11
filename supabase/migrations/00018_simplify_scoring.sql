-- Eksakt — scoring rule simplification.
--
-- Two changes to how match points are computed:
--
--   1. Drop the exact-score rarity bonus.
--      Previously: nailing the exact score gave +4 base AND a rarity
--      bonus on top if <5% (or <=15%) of the league picked the same
--      exact score. The double-bonus made hitting the exact score
--      worth too much, and was hard for users to mentally model. From
--      now on, exact gives the +4 base and that's it.
--
--   2. Outcome rarity (W/D/L) now honours small leagues.
--      The old rule (<5% / 5–15% / >15%) silently disabled itself in
--      small leagues because a single matching peer is already 5%
--      with 20 members. Under 20 members, a contrarian could never
--      hit the +3 cliff. New rule: if you're the only player with
--      that outcome (same_outcome_count = 1), award +3 regardless
--      of league size. Then fall back to the % rule.
--
-- Audit columns on `points` are kept as-is so the UI breakdown still
-- explains what happened; `exact_bonus` will simply always be 0 for
-- matches scored after this migration runs.
--
-- Already-finished matches are NOT recomputed. Their persisted points
-- keep the old rule (including any exact-rarity bonuses). The new
-- rule applies only to matches that finish from now on. This avoids
-- silently shifting historical standings under players.

-- ── 1. Rarity helper with "unique pick" floor ───────────────────────────────

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
  -- "You're the only player with this outcome." Honours small leagues
  -- where the percentage rule below would never fire.
  if p_matching_count <= 1 then
    return 3;
  end if;

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

-- ── 2. compute_points_for_match — exact_bonus always 0 ─────────────────────

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
    -- Exact rarity bonus is permanently disabled. Audit columns
    -- (same_exact_count, exact_pct) continue to be populated.
    0 as exact_bonus,
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

