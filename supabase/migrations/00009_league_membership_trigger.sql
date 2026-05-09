-- Eksakt — fix create-league chicken-and-egg.
--
-- Problem: client does INSERT INTO leagues ... RETURNING *. The RETURNING
-- clause runs the new row through the SELECT policy, which requires the
-- caller to be a league member. The caller isn't a member yet (the
-- application inserted the membership row separately, after the league
-- INSERT). PostgreSQL emits the misleading "new row violates row-level
-- security policy" error.
--
-- Fix:
--   1. Auto-insert the creator into league_members as admin via AFTER
--      INSERT trigger on leagues. Same transaction, runs before RETURNING.
--   2. Loosen the SELECT policy so creators can always see their own
--      league regardless of membership (defensive: an admin removed from
--      members shouldn't lose visibility of a league they own).

-- ── Auto-membership trigger ─────────────────────────────────────────────────

create or replace function public.on_league_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Skip if the creator is already a member somehow (e.g., manual seed).
  insert into public.league_members (league_id, user_id, role)
  values (new.id, new.created_by, 'admin')
  on conflict (league_id, user_id) do nothing;
  return new;
end;
$$;

create trigger leagues_auto_add_creator
  after insert on public.leagues
  for each row execute function public.on_league_created();

-- ── Relax SELECT policy ─────────────────────────────────────────────────────

drop policy if exists leagues_select_member on public.leagues;

create policy leagues_select_member_or_owner on public.leagues
  for select using (
    public.is_league_member(id) or created_by = auth.uid()
  );
