-- College logo / poster image for easy recognition. Public-read bucket; uploads only through the admin-only server route
-- (no client storage policies). SVG is intentionally not allowed (script-injection risk).
alter table public.colleges add column if not exists logo_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('college-logos', 'college-logos', true, 2097152, array['image/png','image/jpeg','image/webp'])
  on conflict (id) do update set public = true;
