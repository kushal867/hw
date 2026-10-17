-- Avatars are public-read images. There are intentionally NO client write policies: uploads go through a
-- server action that validates image signature + size and writes with the service role into <user_id>/<file>.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('avatars', 'avatars', true, 1048576, array['image/png','image/jpeg','image/webp'])
  on conflict (id) do update set public = true;

-- Realtime: stream new comments/posts. Supabase Realtime evaluates the same RLS policies per subscriber,
-- so non-members never receive private-semester events.
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.discussion_comments, public.discussion_posts, public.notifications;
  end if;
end $$;
