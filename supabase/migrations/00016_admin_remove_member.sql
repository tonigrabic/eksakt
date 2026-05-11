-- Eksakt — admin can remove members from a league they administer.
--
-- Adds:
--   1. A SECURITY DEFINER RPC `remove_league_member(p_league_id, p_user_id)`
--      that performs the kick atomically. Validates the caller is an admin
--      of the league, refuses to kick a fellow admin (admins cannot kick
--      each other — escalating that requires a future demote flow), and
--      refuses to kick yourself via this RPC (use the existing leave flow).
--   2. A DELETE policy on league_members that lets admins delete non-admin
--      rows in their league. The RPC is the recommended path, but keeping
--      RLS in sync means direct deletes via PostgREST also work for tooling.
--
-- The previous `league_members_delete_self` policy stays — members can
-- still leave on their own.

create or replace function public.remove_league_member(
  p_league_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_caller_role text;
  v_target_role text;
begin
  if v_caller is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  if v_caller = p_user_id then
    raise exception 'Use the leave-league flow to remove yourself'
      using errcode = '22023';
  end if;

  select role into v_caller_role
  from public.league_members
  where league_id = p_league_id and user_id = v_caller;

  if v_caller_role is null or v_caller_role <> 'admin' then
    raise exception 'Only league admins can remove members'
      using errcode = '42501';
  end if;

  select role into v_target_role
  from public.league_members
  where league_id = p_league_id and user_id = p_user_id;

  if v_target_role is null then
    -- Idempotent: target already gone. Nothing to do.
    return;
  end if;

  if v_target_role = 'admin' then
    raise exception 'Cannot remove another admin'
      using errcode = '42501';
  end if;

  delete from public.league_members
   where league_id = p_league_id
     and user_id = p_user_id;

  -- Their predictions stay (audit trail / standings history). They simply
  -- lose access via the league_members SELECT gate.
end;
$$;

grant execute on function public.remove_league_member(uuid, uuid) to authenticated;

-- Mirror the RPC's intent in RLS so direct deletes are also authorized
-- when the caller is an admin removing a non-admin row.
create policy league_members_delete_by_admin on public.league_members
  for delete using (
    -- Caller is admin of this league...
    exists (
      select 1 from public.league_members lm
      where lm.league_id = league_members.league_id
        and lm.user_id = auth.uid()
        and lm.role = 'admin'
    )
    -- ...and target is not themselves an admin (admins protect admins).
    and league_members.role <> 'admin'
    -- ...and target is not the caller (self-removal uses the existing policy).
    and league_members.user_id <> auth.uid()
  );
