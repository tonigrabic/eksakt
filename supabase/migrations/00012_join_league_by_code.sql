-- Eksakt — join-by-invite-code RPC.
--
-- Why an RPC and not just two client calls:
--   • Looking up a league by invite_code requires reading the leagues row
--     before being a member, but the SELECT policy on leagues requires
--     membership-or-ownership. We don't want to widen that policy (any
--     authenticated user could enumerate every league by guessing UUIDs).
--   • Insert + lookup should be atomic: you should never end up partially
--     joined or "joined to a league that no longer exists".
--   • Idempotent — calling join with an already-joined code returns the
--     same league_id, no error. Friendly UX for double-taps and shared
--     links.
--
-- Security model:
--   • SECURITY DEFINER bypasses RLS inside this function only.
--   • Codes are 4-12 chars per the leagues schema; brute force resistant
--     enough for friend-group invites. Add rate limiting if abuse appears.

create or replace function public.join_league_by_code(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_league_id uuid;
begin
  if v_user_id is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  -- Codes are stored uppercase by createLeague; normalise on read for
  -- friendlier copy-paste from emails / chat.
  select id into v_league_id
  from public.leagues
  where invite_code = upper(trim(p_code))
  limit 1;

  if v_league_id is null then
    raise exception 'invite code not found' using errcode = 'P0002';
  end if;

  insert into public.league_members (league_id, user_id, role)
  values (v_league_id, v_user_id, 'member')
  on conflict (league_id, user_id) do nothing;

  return v_league_id;
end;
$$;

grant execute on function public.join_league_by_code(text) to authenticated;
