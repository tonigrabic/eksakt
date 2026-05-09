-- Eksakt — auto-compute points when a match finishes.
--
-- Fires AFTER UPDATE of matches.status, but only when the transition is
-- INTO 'finished' from something else. Insert-time matches that arrive
-- already-finished (e.g. backfilling historical data) are also handled
-- via an INSERT trigger.

create or replace function public.on_match_status_changed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- UPDATE path: only fire on the transition into 'finished'.
  if TG_OP = 'UPDATE' then
    if new.status = 'finished'
       and (old.status is null or old.status <> 'finished') then
      perform public.compute_points_for_match(new.id);
    end if;
    return new;
  end if;

  -- INSERT path: fire if the row arrives already finished.
  if TG_OP = 'INSERT' then
    if new.status = 'finished' then
      perform public.compute_points_for_match(new.id);
    end if;
    return new;
  end if;

  return new;
end;
$$;

create trigger matches_status_changed_update
  after update of status on public.matches
  for each row execute function public.on_match_status_changed();

create trigger matches_status_changed_insert
  after insert on public.matches
  for each row execute function public.on_match_status_changed();
