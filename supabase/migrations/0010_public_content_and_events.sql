-- Public content + student features:
--   * popularity counters on public notes, saved notes ("bookmarks")
--   * group events (exams, assignment deadlines, classes) with automatic reminders
--   * slugs and course info exposed through the public views, so the site can have a crawlable page per college/course/term/subject
--   * trigram indexes for the new global search
-- Additive only: the running application keeps working while this is applied.
begin;

-- ───────── 1) slugs ─────────
-- Same rule as slugify() in the app: lowercase, runs of non-alphanumerics become "-". Names with no latin letters fall back to the id prefix.
create or replace function public.subject_slug(p_name text, p_id uuid) returns text
language sql immutable as $$
  select coalesce(nullif(trim(both '-' from lower(regexp_replace(p_name, '[^a-zA-Z0-9]+', '-', 'g'))), ''), 's-' || left(p_id::text, 8));
$$;
grant execute on function public.subject_slug(text, uuid) to anon, authenticated, service_role;

-- ───────── 2) popularity counters on documents ─────────
alter table public.documents
  add column if not exists view_count int not null default 0,
  add column if not exists download_count int not null default 0;

-- Counters are written only by the trusted server (service role) after it de-duplicates per visitor.
create or replace function public.record_note_hit(p_doc uuid, p_kind text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_kind = 'view' then
    update documents set view_count = view_count + 1 where id = p_doc and visibility = 'public' and moderation_status = 'approved';
  elsif p_kind = 'download' then
    update documents set download_count = download_count + 1 where id = p_doc and visibility = 'public' and moderation_status = 'approved';
  end if;
end $$;
revoke all on function public.record_note_hit(uuid, text) from public, anon, authenticated;
grant execute on function public.record_note_hit(uuid, text) to service_role;

-- Members must not be able to inflate counters through their own UPDATE grant on documents.
create or replace function public.guard_document_counters() returns trigger language plpgsql as $$
begin
  if auth.uid() is not null and (new.view_count is distinct from old.view_count or new.download_count is distinct from old.download_count) then
    raise exception 'counters are maintained by the server' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists documents_guard_counters on public.documents;
create trigger documents_guard_counters before update on public.documents for each row execute function public.guard_document_counters();

-- ───────── 3) views: append columns (create or replace may only add columns at the end) ─────────
create or replace view public.public_notes as
select d.id, d.title, d.description, d.tags, d.category, d.size_bytes, d.published_at,
       s.id as subject_id, s.name as subject_name,
       sem.id as semester_id, sem.semester_number,
       c.id as course_id, c.name as course_name, c.slug as course_slug,
       col.id as college_id, col.name as college_name, col.slug as college_slug,
       p.display_name as uploader_name,
       c.term_label as term_label,
       d.view_count, d.download_count,
       case when s.id is not null then public.subject_slug(s.name, s.id) end as subject_slug
from documents d
join groups g on g.id = d.group_id
left join semesters sem on sem.id = g.semester_id
left join courses c on c.id = sem.course_id
left join colleges col on col.id = c.college_id
join profiles p on p.id = d.uploaded_by
left join subjects s on s.id = d.subject_id
where d.visibility = 'public' and d.moderation_status = 'approved';
grant select on public.public_notes to anon, authenticated;

create or replace view public.group_directory as
select g.id, g.name, g.description, g.join_policy, g.created_at,
       g.semester_id, sem.semester_number, c.term_label, c.name as course_name, col.id as college_id, col.name as college_name, col.slug as college_slug,
       (select count(*) from group_members m where m.group_id = g.id and m.membership_status = 'active') as member_count,
       c.id as course_id, c.slug as course_slug
from groups g
left join semesters sem on sem.id = g.semester_id
left join courses c on c.id = sem.course_id
left join colleges col on col.id = c.college_id
where g.visibility = 'public' and g.status = 'active';
grant select on public.group_directory to anon, authenticated;

-- ───────── 4) saved notes ─────────
create table if not exists public.note_saves (
  user_id uuid not null references public.profiles(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, document_id)
);
create index if not exists note_saves_doc_idx on public.note_saves (document_id);
alter table public.note_saves enable row level security;

-- Only notes that are publicly published can be saved (checked with owner rights: documents itself is members-only).
create or replace function public.is_public_note(d uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from documents where id = d and visibility = 'public' and moderation_status = 'approved');
$$;
grant execute on function public.is_public_note(uuid) to anon, authenticated, service_role;

create policy saves_read on public.note_saves for select to authenticated using (user_id = auth.uid());
create policy saves_insert on public.note_saves for insert to authenticated
  with check (user_id = auth.uid() and public.is_public_note(document_id) and not public.is_restricted());
create policy saves_delete on public.note_saves for delete to authenticated using (user_id = auth.uid());
grant select, insert, delete on public.note_saves to authenticated;
grant all on public.note_saves to service_role;

-- ───────── 5) group events ─────────
create table if not exists public.group_events (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 120),
  description text check (char_length(description) <= 500),
  kind text not null default 'other' check (kind in ('exam', 'assignment', 'class', 'other')),
  starts_at timestamptz not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  reminded_at timestamptz
);
create index if not exists group_events_group_time on public.group_events (group_id, starts_at);
create index if not exists group_events_due on public.group_events (starts_at) where reminded_at is null;
alter table public.group_events enable row level security;

-- Members read their group's calendar; moderators/owners (and platform admins) manage it.
create policy events_read on public.group_events for select to authenticated using (public.is_group_member(group_id) or public.is_admin());
create policy events_insert on public.group_events for insert to authenticated
  with check (created_by = auth.uid() and public.is_group_mod(group_id) and not public.is_restricted());
create policy events_update on public.group_events for update to authenticated
  using (public.is_group_mod(group_id)) with check (public.is_group_mod(group_id));
create policy events_delete on public.group_events for delete to authenticated using (public.is_group_mod(group_id) or public.is_admin());
grant select, insert, update, delete on public.group_events to authenticated;
grant all on public.group_events to service_role;
-- The reminder bookkeeping column is not user-writable.
revoke update on public.group_events from authenticated;
grant update (title, description, kind, starts_at) on public.group_events to authenticated;

-- Reminders: notify every active member once, when an event is less than 24 hours away. Run every 15 minutes by cron.
create or replace function public.run_event_reminders() returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  with due as (
    update group_events set reminded_at = now()
    where reminded_at is null and starts_at > now() and starts_at <= now() + interval '24 hours'
    returning id, group_id, title, kind, starts_at
  ), ins as (
    insert into notifications (user_id, notification_type, title, body, destination)
    select m.user_id, 'event',
           case due.kind when 'exam' then 'Exam coming up: ' when 'assignment' then 'Deadline coming up: ' else 'Coming up: ' end || due.title,
           to_char(due.starts_at at time zone 'Asia/Kathmandu', 'Dy DD Mon, HH12:MI AM') || ' (Nepal time)',
           '/groups/' || due.group_id || '/events'
    from due join group_members m on m.group_id = due.group_id and m.membership_status = 'active'
    returning 1
  )
  select count(*) into n from ins;
  return coalesce(n, 0);
end $$;
revoke all on function public.run_event_reminders() from public, anon, authenticated;
grant execute on function public.run_event_reminders() to service_role;

-- ───────── 6) search ─────────
create index if not exists subjects_name_trgm on public.subjects using gin (name gin_trgm_ops);
create index if not exists colleges_name_trgm on public.colleges using gin (name gin_trgm_ops);
create index if not exists courses_name_trgm on public.courses using gin (name gin_trgm_ops);
create index if not exists documents_public_idx on public.documents (published_at desc) where visibility = 'public' and moderation_status = 'approved';

commit;
