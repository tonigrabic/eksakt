-- Eksakt — loosen the outcome-rarity thresholds.
--
-- The +3 cliff moves from <5% to <10% of league members matching the
-- outcome; the +1 tier becomes 10–15% (was 5–15%). The lone-caller
-- floor (only player with that outcome → +3 regardless of league
-- size) is unchanged.
--
-- compute_points_for_match (00018) calls this helper, so replacing
-- the function body is the whole change. As with 00018, finished
-- matches are NOT recomputed — the new thresholds apply only to
-- matches that finish from now on.
--
-- Mirrors rarityBonus in src/lib/scoring.ts; keep the two in sync.

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
  if pct < 10 then
    return 3;
  elsif pct <= 15 then
    return 1;
  else
    return 0;
  end if;
end;
$$;
