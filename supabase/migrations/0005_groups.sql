-- Groups: any student can create a group (like a Facebook group) for homework sharing, a class, or a study circle.
-- A group may OPTIONALLY be linked to a college → course → semester (which enables subject tagging and discovery).
-- This replaces "one workspace per semester". Existing semester workspaces are converted to groups, keeping their IDs,
-- so every membership, file, post and question carries over unchanged.

begin;  -- all-or-nothing: a failure leaves the database exactly as it was

-- ───────── 1) groups table ─────────
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 3 and 80),
  description text check (char_length(description) <= 500),
  semester_id uuid references public.semesters(id) on delete set null,   -- optional link into the hierarchy
  visibility text not null default 'public' check (visibility in ('public','private')),
  join_policy text not null default 'approval' check (join_policy in ('open','approval','invite_only')),
  created_by uuid references public.profiles(id) on delete set null,
  status text not null default 'active' check (status in ('active','archived')),
  created_at timestamptz not null default now(),
  check (visibility = 'public' or join_policy = 'invite_only')           -- private groups are invite-only
);
create index on public.groups (semester_id);
create index groups_name_trgm on public.groups using gin (name gin_trgm_ops);

-- Convert every semester that already has activity into a group with the SAME id (private + invite-only, as before).
insert into public.groups (id, name, semester_id, visibility, join_policy)
select s.id, left(col.name || ' — ' || c.name || ' · Semester ' || s.semester_number, 80), s.id, 'private', 'invite_only'
from public.semesters s
join public.courses c on c.id = s.course_id
join public.colleges col on col.id = c.college_id
where s.id in (select semester_id from public.semester_members
               union select semester_id from public.semester_invites
               union select semester_id from public.documents
               union select semester_id from public.discussion_posts
               union select semester_id from public.exam_questions);

-- ───────── 2) drop everything that depends on the old names ─────────
drop policy if exists profiles_read on public.profiles;
drop policy if exists members_read on public.semester_members;
drop policy if exists members_leave on public.semester_members;
drop policy if exists invites_read on public.semester_invites;
drop policy if exists docs_read on public.documents;
drop policy if exists docs_update_own on public.documents;
drop policy if exists docs_delete on public.documents;
drop policy if exists posts_read on public.discussion_posts;
drop policy if exists posts_insert on public.discussion_posts;
drop policy if exists posts_update on public.discussion_posts;
drop policy if exists posts_delete on public.discussion_posts;
drop policy if exists comments_read on public.discussion_comments;
drop policy if exists comments_insert on public.discussion_comments;
drop policy if exists comments_update on public.discussion_comments;
drop policy if exists comments_delete on public.discussion_comments;
drop policy if exists q_read on public.exam_questions;
drop policy if exists q_insert on public.exam_questions;
drop policy if exists q_update on public.exam_questions;
drop policy if exists q_delete on public.exam_questions;
drop view if exists public.public_notes;
drop table public.semester_requests;                                     -- no longer needed: anyone can create a group
drop function public.admin_assign_owner(uuid, uuid, uuid);
drop function public.decide_join_request(uuid, uuid, uuid, boolean);
drop function public.set_member_role(uuid, uuid, uuid, text);
drop function public.remove_member(uuid, uuid, uuid);
drop function public.is_active_member(uuid);
drop function public.is_semester_mod(uuid);
drop function public.shares_semester(uuid);
drop function public.post_semester(uuid);

-- Drop FKs that point at semesters / composite (subject, semester) FKs; they are replaced below.
do $$ declare r record; begin
  for r in select conrelid::regclass as t, conname from pg_constraint
           where contype = 'f' and conrelid::regclass::text in
             ('semester_members','semester_invites','documents','discussion_posts','exam_questions')
             and confrelid in ('public.semesters'::regclass, 'public.subjects'::regclass) loop
    execute format('alter table %s drop constraint %I', r.t, r.conname);
  end loop;
end $$;

-- ───────── 3) rename semester_* → group_* and repoint FKs ─────────
alter table public.semester_members rename to group_members;
alter table public.semester_invites rename to group_invites;
alter table public.group_members rename column semester_id to group_id;
alter table public.group_invites rename column semester_id to group_id;
alter table public.documents rename column semester_id to group_id;
alter table public.discussion_posts rename column semester_id to group_id;
alter table public.exam_questions rename column semester_id to group_id;

alter table public.group_members add foreign key (group_id) references public.groups(id) on delete cascade;
alter table public.group_invites add foreign key (group_id) references public.groups(id) on delete cascade;
alter table public.documents add foreign key (group_id) references public.groups(id) on delete cascade;
alter table public.discussion_posts add foreign key (group_id) references public.groups(id) on delete cascade;
alter table public.exam_questions add foreign key (group_id) references public.groups(id) on delete cascade;
alter table public.documents add foreign key (subject_id) references public.subjects(id) on delete set null;
alter table public.discussion_posts add foreign key (subject_id) references public.subjects(id) on delete set null;
alter table public.exam_questions add foreign key (subject_id) references public.subjects(id) on delete set null;
alter table public.exam_questions alter column subject_id drop not null;   -- unlinked groups have no subjects

-- A tagged subject must belong to the semester the group is linked to (unlinked groups cannot tag subjects).
create or replace function public.check_subject_in_group() returns trigger language plpgsql as $$
begin
  if new.subject_id is not null and not exists (
       select 1 from subjects s join groups g on g.semester_id = s.semester_id
       where s.id = new.subject_id and g.id = new.group_id) then
    raise exception 'subject does not belong to this group''s semester' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger documents_subject_check before insert or update of subject_id, group_id on public.documents for each row execute function public.check_subject_in_group();
create trigger posts_subject_check before insert or update of subject_id, group_id on public.discussion_posts for each row execute function public.check_subject_in_group();
create trigger questions_subject_check before insert or update of subject_id, group_id on public.exam_questions for each row execute function public.check_subject_in_group();

-- ───────── 4) helper predicates (SECURITY DEFINER avoids RLS recursion) ─────────
create or replace function public.is_group_member(g uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from group_members where group_id = g and user_id = auth.uid() and membership_status = 'active');
$$;
create or replace function public.is_group_mod(g uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from group_members where group_id = g and user_id = auth.uid()
                 and membership_status = 'active' and role in ('owner','moderator'));
$$;
create or replace function public.is_group_owner(g uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from group_members where group_id = g and user_id = auth.uid()
                 and membership_status = 'active' and role = 'owner');
$$;
create or replace function public.shares_group(other uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from group_members a join group_members b on a.group_id = b.group_id
                 where a.user_id = auth.uid() and b.user_id = other
                 and a.membership_status = 'active' and b.membership_status = 'active');
$$;
create or replace function public.post_group(p uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select group_id from discussion_posts where id = p;
$$;
create or replace function public.can_see_group(g uuid) returns boolean   -- public+active groups are visible to everyone signed in
language sql stable security definer set search_path = public as $$
  select exists (select 1 from groups x where x.id = g and ((x.visibility = 'public' and x.status = 'active') or public.is_group_member(g)));
$$;

-- ───────── 5) triggers / guards ─────────
create or replace function public.guard_last_owner() returns trigger language plpgsql as $$
begin
  if old.role = 'owner' and old.membership_status = 'active'
     and (tg_op = 'DELETE' or new.role <> 'owner' or new.membership_status <> 'active')
     and exists (select 1 from groups where id = old.group_id)
     and not exists (select 1 from group_members
                     where group_id = old.group_id and role = 'owner' and membership_status = 'active'
                     and user_id <> old.user_id) then
    raise exception 'cannot remove the last owner; transfer ownership first' using errcode = 'P0001';
  end if;
  return coalesce(new, old);
end $$;

create or replace function public.guard_document_update() returns trigger language plpgsql as $$
begin
  if auth.uid() is not null and (
      new.visibility is distinct from old.visibility or new.moderation_status is distinct from old.moderation_status
      or new.storage_path is distinct from old.storage_path or new.uploaded_by is distinct from old.uploaded_by
      or new.group_id is distinct from old.group_id or new.size_bytes is distinct from old.size_bytes) then
    raise exception 'protected document field' using errcode = '42501';
  end if;
  return new;
end $$;

-- Group metadata edits by owners: only name/description/visibility/join_policy (column grants below).
create or replace function public.guard_group_update() returns trigger language plpgsql as $$
begin
  if auth.uid() is not null and (new.id is distinct from old.id or new.created_by is distinct from old.created_by
      or new.semester_id is distinct from old.semester_id or new.status is distinct from old.status) then
    raise exception 'protected group field' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger groups_guard before update on public.groups for each row execute function public.guard_group_update();

-- ───────── 6) privileges + RLS ─────────
alter table public.groups enable row level security;
revoke all on public.groups from anon, authenticated;
grant select on public.groups to authenticated;
grant update (name, description, visibility, join_policy) on public.groups to authenticated;

create policy profiles_read on public.profiles for select to authenticated
  using (id = auth.uid() or public.shares_group(id) or public.is_admin());

create policy groups_read on public.groups for select to authenticated
  using ((visibility = 'public' and status = 'active') or public.is_group_member(id) or public.is_admin());
create policy groups_update on public.groups for update to authenticated
  using (public.is_group_owner(id) and not public.is_restricted()) with check (public.is_group_owner(id));
-- No insert/delete policies: groups are created/deleted only via trusted functions/server code.

create policy members_read on public.group_members for select to authenticated
  using (user_id = auth.uid() or public.is_group_member(group_id) or public.is_admin());
create policy members_leave on public.group_members for delete to authenticated
  using (user_id = auth.uid() and role <> 'owner');
create policy invites_read on public.group_invites for select to authenticated
  using (public.is_group_mod(group_id) or public.is_admin());

create policy docs_read on public.documents for select to authenticated
  using ((public.is_group_member(group_id) and moderation_status <> 'removed') or public.is_group_mod(group_id) or public.is_admin());
create policy docs_update_own on public.documents for update to authenticated
  using (uploaded_by = auth.uid() and public.is_group_member(group_id) and not public.is_restricted()) with check (uploaded_by = auth.uid());
create policy docs_delete on public.documents for delete to authenticated
  using (uploaded_by = auth.uid() or public.is_group_mod(group_id) or public.is_admin());

create policy posts_read on public.discussion_posts for select to authenticated
  using ((public.is_group_member(group_id) and (status = 'visible' or author_id = auth.uid())) or public.is_group_mod(group_id) or public.is_admin());
create policy posts_insert on public.discussion_posts for insert to authenticated
  with check (author_id = auth.uid() and public.is_group_member(group_id) and not public.is_restricted());
create policy posts_update on public.discussion_posts for update to authenticated
  using (author_id = auth.uid() and status = 'visible' and not public.is_restricted()) with check (author_id = auth.uid());
create policy posts_delete on public.discussion_posts for delete to authenticated
  using (author_id = auth.uid() or public.is_group_mod(group_id) or public.is_admin());

create policy comments_read on public.discussion_comments for select to authenticated
  using ((public.is_group_member(public.post_group(post_id)) and (status = 'visible' or author_id = auth.uid()))
         or public.is_group_mod(public.post_group(post_id)) or public.is_admin());
create policy comments_insert on public.discussion_comments for insert to authenticated
  with check (author_id = auth.uid() and public.is_group_member(public.post_group(post_id)) and not public.is_restricted());
create policy comments_update on public.discussion_comments for update to authenticated
  using (author_id = auth.uid() and status = 'visible' and not public.is_restricted()) with check (author_id = auth.uid());
create policy comments_delete on public.discussion_comments for delete to authenticated
  using (author_id = auth.uid() or public.is_group_mod(public.post_group(post_id)) or public.is_admin());

create policy q_read on public.exam_questions for select to authenticated
  using ((public.is_group_member(group_id) and status = 'visible') or created_by = auth.uid()
         or public.is_group_mod(group_id) or public.is_admin());
create policy q_insert on public.exam_questions for insert to authenticated
  with check (created_by = auth.uid() and public.is_group_member(group_id) and not public.is_restricted()
              and question_type in ('practice','previous_exam'));
create policy q_update on public.exam_questions for update to authenticated
  using (created_by = auth.uid() and not public.is_restricted()) with check (created_by = auth.uid());
create policy q_delete on public.exam_questions for delete to authenticated
  using (created_by = auth.uid() or public.is_group_mod(group_id) or public.is_admin());

-- Re-grant insert columns that referenced the old column name (column privileges follow the column, but be explicit).
grant insert (group_id, subject_id, author_id, title, body, post_type) on public.discussion_posts to authenticated;
grant insert (group_id, subject_id, created_by, question_text, answer_text, topic, question_type, source_note) on public.exam_questions to authenticated;

-- ───────── 7) views ─────────
-- Public notes: approved + public documents only. Group name is deliberately NOT exposed (a private group's name must not leak).
create view public.public_notes as
select d.id, d.title, d.description, d.tags, d.category, d.size_bytes, d.published_at,
       s.id as subject_id, s.name as subject_name,
       sem.id as semester_id, sem.semester_number,
       c.id as course_id, c.name as course_name, c.slug as course_slug,
       col.id as college_id, col.name as college_name, col.slug as college_slug,
       p.display_name as uploader_name
from documents d
join groups g on g.id = d.group_id
left join semesters sem on sem.id = g.semester_id
left join courses c on c.id = sem.course_id
left join colleges col on col.id = c.college_id
join profiles p on p.id = d.uploaded_by
left join subjects s on s.id = d.subject_id
where d.visibility = 'public' and d.moderation_status = 'approved';
grant select on public.public_notes to anon, authenticated;

-- Group directory: discoverable public groups (name, description, linked college/semester, member count). No content.
create view public.group_directory as
select g.id, g.name, g.description, g.join_policy, g.created_at,
       g.semester_id, sem.semester_number, c.name as course_name, col.id as college_id, col.name as college_name, col.slug as college_slug,
       (select count(*) from group_members m where m.group_id = g.id and m.membership_status = 'active') as member_count
from groups g
left join semesters sem on sem.id = g.semester_id
left join courses c on c.id = sem.course_id
left join colleges col on col.id = c.college_id
where g.visibility = 'public' and g.status = 'active';
grant select on public.group_directory to anon, authenticated;

-- ───────── 8) trusted functions (service role only) ─────────
create or replace function public.create_group(p_user uuid, p_name text, p_desc text, p_semester uuid, p_visibility text, p_policy text) returns uuid
language plpgsql security definer set search_path = public as $$
declare gid uuid;
begin
  if exists (select 1 from profiles where id = p_user and restricted_until > now()) then raise exception 'restricted' using errcode = '42501'; end if;
  if (select count(*) from group_members where user_id = p_user and role = 'owner' and membership_status = 'active') >= 20 then
    raise exception 'group limit reached' using errcode = 'P0001';
  end if;
  insert into groups (name, description, semester_id, visibility, join_policy, created_by)
    values (trim(p_name), nullif(trim(coalesce(p_desc, '')), ''), p_semester, p_visibility, case when p_visibility = 'private' then 'invite_only' else p_policy end, p_user)
    returning id into gid;
  insert into group_members (group_id, user_id, role, membership_status) values (gid, p_user, 'owner', 'active');
  insert into audit_logs (actor_id, action, target_type, target_id) values (p_user, 'group.create', 'group', gid::text);
  return gid;
end $$;

-- Join a PUBLIC group directly (open) or request to join (approval). Private / invite-only groups need an invitation.
create or replace function public.join_group(p_user uuid, p_group uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare g groups; mem group_members;
begin
  select * into g from groups where id = p_group and status = 'active';
  if not found or g.visibility <> 'public' or g.join_policy = 'invite_only' then return jsonb_build_object('status','invalid'); end if;
  if exists (select 1 from profiles where id = p_user and restricted_until > now()) then return jsonb_build_object('status','restricted'); end if;
  select * into mem from group_members where group_id = p_group and user_id = p_user;
  if found then
    if mem.membership_status = 'active' then return jsonb_build_object('status','already_member','group_id',p_group); end if;
    if mem.membership_status = 'pending' then return jsonb_build_object('status','pending','group_id',p_group); end if;
    return jsonb_build_object('status','blocked');
  end if;
  insert into group_members (group_id, user_id, role, membership_status)
    values (p_group, p_user, 'member', case when g.join_policy = 'open' then 'active' else 'pending' end);
  insert into audit_logs (actor_id, action, target_type, target_id, metadata)
    values (p_user, 'group.join', 'group', p_group::text, jsonb_build_object('policy', g.join_policy));
  return jsonb_build_object('status', case when g.join_policy = 'open' then 'joined' else 'pending' end, 'group_id', p_group);
end $$;

create or replace function public.redeem_invite(p_token_hash text, p_user uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare inv group_invites; mem group_members; g groups;
begin
  select * into inv from group_invites where token_hash = p_token_hash for update;   -- row lock serialises concurrent redeems
  if not found or inv.revoked_at is not null or inv.expires_at <= now()
     or (inv.max_uses is not null and inv.used_count >= inv.max_uses) then
    return jsonb_build_object('status','invalid');
  end if;
  select * into g from groups where id = inv.group_id;
  if g.status <> 'active' then return jsonb_build_object('status','invalid'); end if;
  if exists (select 1 from profiles where id = p_user and restricted_until > now()) then
    return jsonb_build_object('status','restricted');
  end if;
  select * into mem from group_members where group_id = inv.group_id and user_id = p_user;
  if found then
    if mem.membership_status = 'active' then return jsonb_build_object('status','already_member','group_id',inv.group_id); end if;
    if mem.membership_status = 'pending' then return jsonb_build_object('status','pending','group_id',inv.group_id); end if;
    return jsonb_build_object('status','blocked');          -- removed by a moderator: needs a moderator to re-add
  end if;
  insert into group_members (group_id, user_id, role, membership_status)
    values (inv.group_id, p_user, 'member', case when inv.requires_approval then 'pending' else 'active' end);
  update group_invites set used_count = used_count + 1 where id = inv.id;
  insert into audit_logs (actor_id, action, target_type, target_id, metadata)
    values (p_user, 'invite.redeem', 'group', inv.group_id::text, jsonb_build_object('invite', inv.id, 'pending', inv.requires_approval));
  return jsonb_build_object('status', case when inv.requires_approval then 'pending' else 'joined' end, 'group_id', inv.group_id);
end $$;

create or replace function public.decide_join_request(p_actor uuid, p_group uuid, p_target uuid, p_approve boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from group_members where group_id=p_group and user_id=p_actor and membership_status='active' and role in ('owner','moderator'))
     and not exists (select 1 from profiles where id=p_actor and platform_role='admin') then
    raise exception 'forbidden' using errcode='42501';
  end if;
  if p_approve then
    update group_members set membership_status='active', joined_at=now() where group_id=p_group and user_id=p_target and membership_status='pending';
  else
    delete from group_members where group_id=p_group and user_id=p_target and membership_status='pending';
  end if;
  insert into audit_logs (actor_id, action, target_type, target_id, metadata)
    values (p_actor, case when p_approve then 'member.approve' else 'member.reject' end, 'group', p_group::text, jsonb_build_object('user', p_target));
end $$;

create or replace function public.set_member_role(p_actor uuid, p_group uuid, p_target uuid, p_role text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_role not in ('owner','moderator','member') then raise exception 'bad role'; end if;
  if not exists (select 1 from group_members where group_id=p_group and user_id=p_actor and membership_status='active' and role='owner') then
    raise exception 'forbidden' using errcode='42501';
  end if;
  if not exists (select 1 from group_members where group_id=p_group and user_id=p_target and membership_status='active') then
    raise exception 'target is not an active member';
  end if;
  if p_target = p_actor and p_role <> 'owner' then raise exception 'transfer ownership before stepping down'; end if;
  if p_role = 'owner' and p_target <> p_actor then
    update group_members set role='owner' where group_id=p_group and user_id=p_target;
    update group_members set role='moderator' where group_id=p_group and user_id=p_actor;
  elsif p_target <> p_actor then
    update group_members set role=p_role where group_id=p_group and user_id=p_target;
  end if;
  insert into audit_logs (actor_id, action, target_type, target_id, metadata)
    values (p_actor, 'member.role', 'group', p_group::text, jsonb_build_object('user', p_target, 'role', p_role));
end $$;

create or replace function public.remove_member(p_actor uuid, p_group uuid, p_target uuid) returns void
language plpgsql security definer set search_path = public as $$
declare actor_role text; target_role text;
begin
  select role into actor_role from group_members where group_id=p_group and user_id=p_actor and membership_status='active';
  select role into target_role from group_members where group_id=p_group and user_id=p_target;
  if actor_role is null or actor_role = 'member' or target_role is null or target_role = 'owner'
     or (actor_role = 'moderator' and target_role = 'moderator') or p_actor = p_target then
    raise exception 'forbidden' using errcode='42501';
  end if;
  update group_members set membership_status='removed' where group_id=p_group and user_id=p_target;
  insert into audit_logs (actor_id, action, target_type, target_id, metadata)
    values (p_actor, 'member.remove', 'group', p_group::text, jsonb_build_object('user', p_target));
end $$;

create or replace function public.evaluate_badges(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
declare approved_docs int; bad_reports int; helpful_comments int; saves int;
begin
  select count(*) into bad_reports from reports r where r.status='actioned' and
     ((r.target_type='document' and r.target_id in (select id from documents where uploaded_by=p_user)) or
      (r.target_type='post' and r.target_id in (select id from discussion_posts where author_id=p_user)) or
      (r.target_type='comment' and r.target_id in (select id from discussion_comments where author_id=p_user)));
  if bad_reports = 0 then
    select count(*) into approved_docs from documents where uploaded_by=p_user and visibility='public' and moderation_status='approved';
    if approved_docs >= 3 then insert into profile_badges (user_id, badge_type) values (p_user,'notes_sharer') on conflict do nothing; end if;
    select count(distinct c.post_id) into helpful_comments from discussion_comments c join discussion_posts p on p.id=c.post_id
      where c.author_id=p_user and c.status='visible' and p.author_id<>p_user;
    if helpful_comments >= 5 then insert into profile_badges (user_id, badge_type) values (p_user,'discussion_helper') on conflict do nothing; end if;
    select count(*) into saves from saved_questions s join exam_questions q on q.id=s.question_id where q.created_by=p_user and s.user_id<>p_user;
    if saves >= 5 then insert into profile_badges (user_id, badge_type) values (p_user,'helpful_contributor') on conflict do nothing; end if;
  end if;
  -- Owning/moderating a group that has other active members (not a one-person group) earns the informational moderator badge.
  if exists (select 1 from group_members m where m.user_id=p_user and m.membership_status='active' and m.role in ('owner','moderator')
             and (select count(*) from group_members x where x.group_id=m.group_id and x.membership_status='active') >= 3) then
    insert into profile_badges (user_id, badge_type) values (p_user,'semester_moderator') on conflict do nothing;
  end if;
end $$;

revoke all on function public.create_group, public.join_group, public.redeem_invite, public.decide_join_request,
  public.set_member_role, public.remove_member, public.evaluate_badges from public, anon, authenticated;
grant execute on function public.create_group, public.join_group, public.redeem_invite, public.decide_join_request,
  public.set_member_role, public.remove_member, public.evaluate_badges to service_role;
revoke all on function public.check_subject_in_group, public.guard_group_update, public.guard_last_owner, public.guard_document_update from public, anon, authenticated;
grant execute on function public.is_group_member, public.is_group_mod, public.is_group_owner, public.shares_group,
  public.post_group, public.can_see_group to anon, authenticated;

commit;
