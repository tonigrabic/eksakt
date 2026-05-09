-- Eksakt — triggers
--
-- Two responsibilities:
--   1. Create a public.profiles row whenever a new auth.users row is inserted
--      (signup). Pulls display_name from raw_user_meta_data, falling back to
--      the email's local-part so the profile is never NULL.
--   2. Maintain updated_at on tables that mutate.

-- ── Auto-create profile on signup ───────────────────────────────────────────

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'display_name',
      new.raw_user_meta_data ->> 'name',
      split_part(new.email, '@', 1)
    ),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── updated_at maintenance ──────────────────────────────────────────────────

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

create trigger matches_touch_updated_at
  before update on public.matches
  for each row execute function public.touch_updated_at();

create trigger predictions_touch_updated_at
  before update on public.predictions
  for each row execute function public.touch_updated_at();
