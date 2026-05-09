-- Eksakt — profile avatars
--
-- Adds a public Storage bucket for user avatars plus RLS that scopes
-- writes to each user's own folder. Path convention:
--
--     avatars/<user_id>/<timestamp>.<ext>
--
-- Reads are open (the bucket is public) so other members can see avatars
-- in standings and prediction tables without needing signed URLs. Writes
-- are restricted: a user can only upload/replace/delete files inside the
-- folder named after their own auth.uid().
--
-- profiles.avatar_url stores the resulting public URL string.

-- ── Bucket ─────────────────────────────────────────────────────────────────
--
-- `public = true` makes objects in the bucket reachable via the public
-- CDN URL. `on conflict do nothing` so re-running the migration (e.g.
-- via `supabase db reset`) is idempotent.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  2097152,                                                  -- 2 MiB cap
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

-- ── Storage RLS ────────────────────────────────────────────────────────────
--
-- storage.objects has RLS enabled by default in Supabase projects. We
-- only need to add per-bucket policies. The path-prefix check uses
-- storage.foldername() which splits the object name on '/' — element [1]
-- is the top-level folder, which we constrain to be the caller's UUID.

-- Public read: anyone can fetch any avatar. Backed by the public bucket
-- flag above; this policy keeps the SDK happy when callers list objects.
create policy avatars_public_read on storage.objects
  for select
  using (bucket_id = 'avatars');

-- Own-folder writes only.
create policy avatars_user_insert on storage.objects
  for insert
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy avatars_user_update on storage.objects
  for update
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy avatars_user_delete on storage.objects
  for delete
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
