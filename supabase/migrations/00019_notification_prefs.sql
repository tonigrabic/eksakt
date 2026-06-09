-- Eksakt — notification preferences
--
-- Adds an opt-out switch for transactional reminder emails. Defaults to
-- ON so existing users keep getting the daily "you haven't predicted"
-- nudge unless they explicitly turn it off from their profile.
--
-- This flag gates the prediction-reminder job (see 00020). It does NOT
-- affect auth emails (magic link / sign-in code) — those are essential
-- and always sent.

alter table public.profiles
  add column notifications_enabled boolean not null default true;

comment on column public.profiles.notifications_enabled is
  'User opt-in for transactional reminder emails (prediction nudges). '
  'Auth emails ignore this flag.';
