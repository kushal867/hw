-- Row Level Security, protected-field guards, and trusted functions.
-- Principle: users get narrow, explicit access; anything privileged (role changes, invite redemption,
-- document inserts, publication) runs only through service-role-only functions called from server code.

-- ───────── Helper predicates (SECURITY DEFINER avoids RLS recursion) ─────────
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and platform_role = 'admin');
$$;
create or replace function public.is_restricted() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and restricted_until is not null and restricted_until > now());
$$;
create or replace function public.is_active_member(sem uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from semester_members where semester_id = sem and user_id = auth.uid() and membership_status = 'active');
$$;
create or replace function public.is_semester_mod(sem uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from semester_members where semester_id = sem and user_id = auth.uid()
                 and membership_status = 'active' and role in ('owner','moderator'));
$$;
create or replace function public.shares_semester(other uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from semester_members a join semester_members b on a.semester_id = b.semester_id
                 where a.user_id = auth.uid() and b.user_id = other
                 and a.membership_status = 'active' and b.membership_status = 'active');
$$;
create or replace function public.post_semester(p uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select semester_id from discussion_posts where id = p;
$$;

-- ───────── Triggers ─────────
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger documents_touch before update on public.documents for each row execute function public.touch_updated_at();
create trigger posts_touch before update on public.discussion_posts for each row execute function public.touch_updated_at();

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare nm text;
begin
  nm := coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'), ''), split_part(new.email, '@', 1));
  if char_length(nm) < 2 then nm := 'Student'; end if;
  insert into profiles (id, display_name) values (new.id, left(nm, 60));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Defense in depth: even if grants were widened by mistake, end-users can never change protected profile fields.
create or replace function public.guard_profile_update() returns trigger language plpgsql as $$
begin
  if auth.uid() is not null and (
       new.platform_role is distinct from old.platform_role or
       new.restricted_until is distinct from old.restricted_until or
       new.restriction_reason is distinct from old.restriction_reason or
       new.id is distinct from old.id) then
    raise exception 'protected profile field' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger profiles_guard before update on public.profiles for each row execute function public.guard_profile_update();

-- Never allow a semester to lose its last active owner (except when the semester itself is deleted).
create or replace function public.guard_last_owner() returns trigger language plpgsql as $$
begin
  if old.role = 'owner' and old.membership_status = 'active'
     and (tg_op = 'DELETE' or new.role <> 'owner' or new.membership_status <> 'active')
     and exists (select 1 from semesters where id = old.semester_id)
     and not exists (select 1 from semester_members
                     where semester_id = old.semester_id and role = 'owner' and membership_status = 'active'
                     and user_id <> old.user_id) then
    raise exception 'cannot remove the last owner; transfer ownership first' using errcode = 'P0001';
  end if;
  return coalesce(new, old);
end $$;
create trigger members_last_owner before update or delete on public.semester_members for each row execute function public.guard_last_owner();

-- Document consistency: publicly visible rows must have published_at.
create or replace function public.guard_document_update() returns trigger language plpgsql as $$
begin
  if auth.uid() is not null and (
      new.visibility is distinct from old.visibility or new.moderation_status is distinct from old.moderation_status
      or new.storage_path is distinct from old.storage_path or new.uploaded_by is distinct from old.uploaded_by
      or new.semester_id is distinct from old.semester_id or new.size_bytes is distinct from old.size_bytes) then
    raise exception 'protected document field' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger documents_guard before update on public.documents for each row execute function public.guard_document_update();

-- ───────── Table privileges: start from nothing, grant narrowly ─────────
revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;
grant usage on schema public to anon, authenticated;

grant select on public.colleges, public.courses, public.semesters, public.subjects to anon, authenticated;
grant insert, update, delete on public.colleges, public.courses, public.semesters, public.subjects to authenticated; -- gated by is_admin() policies
grant select on public.profiles to authenticated;
grant update (display_name, username, avatar_path, preferred_language, bio, college_id, course_id, semester_id) on public.profiles to authenticated;
grant select, delete on public.semester_members to authenticated;
grant select on public.semester_invites to authenticated;
grant select, insert, delete on public.semester_requests to authenticated;
grant select, delete on public.documents to authenticated;
grant update (title, description, tags, category, subject_id) on public.documents to authenticated;
grant select, delete on public.discussion_posts, public.discussion_comments to authenticated;
grant insert (semester_id, subject_id, author_id, title, body, post_type) on public.discussion_posts to authenticated;
grant update (title, body, subject_id, post_type) on public.discussion_posts to authenticated;
grant insert (post_id, author_id, body) on public.discussion_comments to authenticated;
grant update (body) on public.discussion_comments to authenticated;
grant select, delete on public.exam_questions to authenticated;
grant insert (semester_id, subject_id, created_by, question_text, answer_text, topic, question_type, source_note) on public.exam_questions to authenticated;
grant update (question_text, answer_text, topic, source_note) on public.exam_questions to authenticated;
grant select, insert, delete on public.saved_questions to authenticated;
grant select on public.reports to authenticated;
grant insert (reporter_id, target_type, target_id, reason, details) on public.reports to authenticated;
grant select, delete on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant select on public.profile_badges to authenticated, anon;
grant select on public.audit_logs to authenticated;
grant select, insert on public.deletion_requests to authenticated;
-- rate_limits: no grants at all.

-- ───────── Enable RLS everywhere ─────────
do $$ declare t text; begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- ───────── Policies ─────────
-- Hierarchy: public read of active rows; admin-only writes.
create policy hier_read on public.colleges for select using (status = 'active' or public.is_admin());
create policy hier_read on public.courses for select using (status = 'active' or public.is_admin());
create policy hier_read on public.semesters for select using (status = 'active' or public.is_admin());
create policy hier_read on public.subjects for select using (status = 'active' or public.is_admin());
create policy hier_write_i on public.colleges for insert with check (public.is_admin());
create policy hier_write_u on public.colleges for update using (public.is_admin()) with check (public.is_admin());
create policy hier_write_d on public.colleges for delete using (public.is_admin());
create policy hier_write_i on public.courses for insert with check (public.is_admin());
create policy hier_write_u on public.courses for update using (public.is_admin()) with check (public.is_admin());
create policy hier_write_d on public.courses for delete using (public.is_admin());
create policy hier_write_i on public.semesters for insert with check (public.is_admin());
create policy hier_write_u on public.semesters for update using (public.is_admin()) with check (public.is_admin());
create policy hier_write_d on public.semesters for delete using (public.is_admin());
create policy hier_write_i on public.subjects for insert with check (public.is_admin());
create policy hier_write_u on public.subjects for update using (public.is_admin()) with check (public.is_admin());
create policy hier_write_d on public.subjects for delete using (public.is_admin());

-- Profiles: self, classmates, admins. Email/phone are never stored here.
create policy profiles_read on public.profiles for select to authenticated
  using (id = auth.uid() or public.shares_semester(id) or public.is_admin());
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Membership: members see their semester roster; nobody inserts/updates directly (RPCs only). Users may leave.
create policy members_read on public.semester_members for select to authenticated
  using (user_id = auth.uid() or public.is_active_member(semester_id) or public.is_admin());
create policy members_leave on public.semester_members for delete to authenticated
  using (user_id = auth.uid() and role <> 'owner');

create policy invites_read on public.semester_invites for select to authenticated
  using (public.is_semester_mod(semester_id) or public.is_admin());

create policy sreq_read on public.semester_requests for select to authenticated using (requester_id = auth.uid() or public.is_admin());
create policy sreq_insert on public.semester_requests for insert to authenticated with check (requester_id = auth.uid() and not public.is_restricted());
create policy sreq_delete on public.semester_requests for delete to authenticated using (requester_id = auth.uid());

-- Documents (metadata). Inserts happen server-side after file validation. Public discovery uses the public_notes view.
create policy docs_read on public.documents for select to authenticated
  using ((public.is_active_member(semester_id) and moderation_status <> 'removed')
         or public.is_semester_mod(semester_id) or public.is_admin());
create policy docs_update_own on public.documents for update to authenticated
  using (uploaded_by = auth.uid() and public.is_active_member(semester_id) and not public.is_restricted())
  with check (uploaded_by = auth.uid());
create policy docs_delete on public.documents for delete to authenticated
  using (uploaded_by = auth.uid() or public.is_semester_mod(semester_id) or public.is_admin());

-- Discussions
create policy posts_read on public.discussion_posts for select to authenticated
  using ((public.is_active_member(semester_id) and (status = 'visible' or author_id = auth.uid()))
         or public.is_semester_mod(semester_id) or public.is_admin());
create policy posts_insert on public.discussion_posts for insert to authenticated
  with check (author_id = auth.uid() and public.is_active_member(semester_id) and not public.is_restricted());
create policy posts_update on public.discussion_posts for update to authenticated
  using (author_id = auth.uid() and status = 'visible' and not public.is_restricted()) with check (author_id = auth.uid());
create policy posts_delete on public.discussion_posts for delete to authenticated
  using (author_id = auth.uid() or public.is_semester_mod(semester_id) or public.is_admin());

create policy comments_read on public.discussion_comments for select to authenticated
  using ((public.is_active_member(public.post_semester(post_id)) and (status = 'visible' or author_id = auth.uid()))
         or public.is_semester_mod(public.post_semester(post_id)) or public.is_admin());
create policy comments_insert on public.discussion_comments for insert to authenticated
  with check (author_id = auth.uid() and public.is_active_member(public.post_semester(post_id)) and not public.is_restricted());
create policy comments_update on public.discussion_comments for update to authenticated
  using (author_id = auth.uid() and status = 'visible' and not public.is_restricted()) with check (author_id = auth.uid());
create policy comments_delete on public.discussion_comments for delete to authenticated
  using (author_id = auth.uid() or public.is_semester_mod(public.post_semester(post_id)) or public.is_admin());

-- Exam questions: students may only create practice / previous_exam; teacher_confirmed is server-only.
create policy q_read on public.exam_questions for select to authenticated
  using ((public.is_active_member(semester_id) and status = 'visible') or created_by = auth.uid()
         or public.is_semester_mod(semester_id) or public.is_admin());
create policy q_insert on public.exam_questions for insert to authenticated
  with check (created_by = auth.uid() and public.is_active_member(semester_id) and not public.is_restricted()
              and question_type in ('practice','previous_exam'));
create policy q_update on public.exam_questions for update to authenticated
  using (created_by = auth.uid() and not public.is_restricted()) with check (created_by = auth.uid());
create policy q_delete on public.exam_questions for delete to authenticated
  using (created_by = auth.uid() or public.is_semester_mod(semester_id) or public.is_admin());

create policy saved_all_r on public.saved_questions for select to authenticated using (user_id = auth.uid());
create policy saved_all_i on public.saved_questions for insert to authenticated with check (user_id = auth.uid());
create policy saved_all_d on public.saved_questions for delete to authenticated using (user_id = auth.uid());

-- Reports: reporters see only their own; admins see all (semester mods act via server routes).
create policy reports_read on public.reports for select to authenticated using (reporter_id = auth.uid() or public.is_admin());
create policy reports_insert on public.reports for insert to authenticated with check (reporter_id = auth.uid() and not public.is_restricted());

create policy notif_read on public.notifications for select to authenticated using (user_id = auth.uid());
create policy notif_update on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notif_delete on public.notifications for delete to authenticated using (user_id = auth.uid());

create policy badges_read on public.profile_badges for select using (true);
create policy audit_read on public.audit_logs for select to authenticated using (public.is_admin());
create policy delreq_read on public.deletion_requests for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy delreq_insert on public.deletion_requests for insert to authenticated with check (user_id = auth.uid());

-- ───────── Public notes view (the ONLY anonymous window into documents) ─────────
-- Runs with owner rights, exposes only approved+public rows and no storage_path.
create view public.public_notes as
select d.id, d.title, d.description, d.tags, d.category, d.size_bytes, d.published_at,
       s.id as subject_id, s.name as subject_name,
       sem.id as semester_id, sem.semester_number,
       c.id as course_id, c.name as course_name, c.slug as course_slug,
       col.id as college_id, col.name as college_name, col.slug as college_slug,
       p.display_name as uploader_name
from documents d
join semesters sem on sem.id = d.semester_id
join courses c on c.id = sem.course_id
join colleges col on col.id = c.college_id
join profiles p on p.id = d.uploaded_by
left join subjects s on s.id = d.subject_id
where d.visibility = 'public' and d.moderation_status = 'approved';
grant select on public.public_notes to anon, authenticated;

-- ───────── Trusted functions: callable ONLY by the service role (server code) ─────────
create or replace function public.redeem_invite(p_token_hash text, p_user uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare inv semester_invites; need_approval boolean; mem semester_members; sem_req boolean;
begin
  select * into inv from semester_invites where token_hash = p_token_hash for update;   -- row lock serialises concurrent redeems
  if not found or inv.revoked_at is not null or inv.expires_at <= now()
     or (inv.max_uses is not null and inv.used_count >= inv.max_uses) then
    return jsonb_build_object('status','invalid');
  end if;
  if exists (select 1 from profiles where id = p_user and restricted_until > now()) then
    return jsonb_build_object('status','restricted');
  end if;
  select * into mem from semester_members where semester_id = inv.semester_id and user_id = p_user;
  if found then
    if mem.membership_status = 'active' then return jsonb_build_object('status','already_member','semester_id',inv.semester_id); end if;
    if mem.membership_status = 'pending' then return jsonb_build_object('status','pending','semester_id',inv.semester_id); end if;
    return jsonb_build_object('status','blocked');          -- removed by a moderator: needs a moderator to re-add
  end if;
  select requires_approval into sem_req from semesters where id = inv.semester_id;
  need_approval := inv.requires_approval or coalesce(sem_req,false);
  insert into semester_members (semester_id, user_id, role, membership_status)
    values (inv.semester_id, p_user, 'member', case when need_approval then 'pending' else 'active' end);
  update semester_invites set used_count = used_count + 1 where id = inv.id;
  insert into audit_logs (actor_id, action, target_type, target_id, metadata)
    values (p_user, 'invite.redeem', 'semester', inv.semester_id::text, jsonb_build_object('invite', inv.id, 'pending', need_approval));
  return jsonb_build_object('status', case when need_approval then 'pending' else 'joined' end, 'semester_id', inv.semester_id);
end $$;

create or replace function public.decide_join_request(p_actor uuid, p_sem uuid, p_target uuid, p_approve boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from semester_members where semester_id=p_sem and user_id=p_actor and membership_status='active' and role in ('owner','moderator'))
     and not exists (select 1 from profiles where id=p_actor and platform_role='admin') then
    raise exception 'forbidden' using errcode='42501';
  end if;
  if p_approve then
    update semester_members set membership_status='active', joined_at=now() where semester_id=p_sem and user_id=p_target and membership_status='pending';
  else
    delete from semester_members where semester_id=p_sem and user_id=p_target and membership_status='pending';
  end if;
  insert into audit_logs (actor_id, action, target_type, target_id, metadata)
    values (p_actor, case when p_approve then 'member.approve' else 'member.reject' end, 'semester', p_sem::text, jsonb_build_object('user', p_target));
end $$;

-- Owner-only: promote/demote. Promoting to owner is a transfer (actor becomes moderator) so ownership is never duplicated by accident.
create or replace function public.set_member_role(p_actor uuid, p_sem uuid, p_target uuid, p_role text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_role not in ('owner','moderator','member') then raise exception 'bad role'; end if;
  if not exists (select 1 from semester_members where semester_id=p_sem and user_id=p_actor and membership_status='active' and role='owner') then
    raise exception 'forbidden' using errcode='42501';
  end if;
  if not exists (select 1 from semester_members where semester_id=p_sem and user_id=p_target and membership_status='active') then
    raise exception 'target is not an active member';
  end if;
  if p_target = p_actor and p_role <> 'owner' then raise exception 'transfer ownership before stepping down'; end if;
  if p_role = 'owner' and p_target <> p_actor then
    update semester_members set role='owner' where semester_id=p_sem and user_id=p_target;
    update semester_members set role='moderator' where semester_id=p_sem and user_id=p_actor;
  elsif p_target <> p_actor then
    update semester_members set role=p_role where semester_id=p_sem and user_id=p_target;
  end if;
  insert into audit_logs (actor_id, action, target_type, target_id, metadata)
    values (p_actor, 'member.role', 'semester', p_sem::text, jsonb_build_object('user', p_target, 'role', p_role));
end $$;

create or replace function public.remove_member(p_actor uuid, p_sem uuid, p_target uuid) returns void
language plpgsql security definer set search_path = public as $$
declare actor_role text; target_role text;
begin
  select role into actor_role from semester_members where semester_id=p_sem and user_id=p_actor and membership_status='active';
  select role into target_role from semester_members where semester_id=p_sem and user_id=p_target;
  if actor_role is null or actor_role = 'member' or target_role is null or target_role = 'owner'
     or (actor_role = 'moderator' and target_role = 'moderator') or p_actor = p_target then
    raise exception 'forbidden' using errcode='42501';
  end if;
  update semester_members set membership_status='removed' where semester_id=p_sem and user_id=p_target;
  insert into audit_logs (actor_id, action, target_type, target_id, metadata)
    values (p_actor, 'member.remove', 'semester', p_sem::text, jsonb_build_object('user', p_target));
end $$;

-- Platform admin seeds the first owner of a semester (also resolves "request group creation").
create or replace function public.admin_assign_owner(p_actor uuid, p_sem uuid, p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from profiles where id=p_actor and platform_role='admin') then raise exception 'forbidden' using errcode='42501'; end if;
  insert into semester_members (semester_id, user_id, role, membership_status) values (p_sem, p_user, 'owner', 'active')
    on conflict (semester_id, user_id) do update set role='owner', membership_status='active';
  update semester_requests set status='approved' where semester_id=p_sem and requester_id=p_user;
  insert into audit_logs (actor_id, action, target_type, target_id, metadata)
    values (p_actor, 'semester.assign_owner', 'semester', p_sem::text, jsonb_build_object('user', p_user));
end $$;

-- Fixed-window rate limiter. Returns true when the call is allowed.
create or replace function public.check_rate_limit(p_user uuid, p_bucket text, p_max int, p_window_seconds int) returns boolean
language plpgsql security definer set search_path = public as $$
declare w timestamptz; h int;
begin
  w := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  insert into rate_limits (user_id, bucket, window_start, hits) values (p_user, p_bucket, w, 1)
    on conflict (user_id, bucket, window_start) do update set hits = rate_limits.hits + 1 returning hits into h;
  delete from rate_limits where window_start < now() - interval '1 day';
  return h <= p_max;
end $$;

-- Badge rules: quality-gated, not raw volume. Awarded only by this function (service role).
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
  if exists (select 1 from semester_members where user_id=p_user and membership_status='active' and role in ('owner','moderator')) then
    insert into profile_badges (user_id, badge_type) values (p_user,'semester_moderator') on conflict do nothing;
  end if;
end $$;

-- Lock trusted functions to the service role only.
revoke all on function public.redeem_invite, public.decide_join_request, public.set_member_role, public.remove_member,
  public.admin_assign_owner, public.check_rate_limit, public.evaluate_badges from public, anon, authenticated;
grant execute on function public.redeem_invite, public.decide_join_request, public.set_member_role, public.remove_member,
  public.admin_assign_owner, public.check_rate_limit, public.evaluate_badges to service_role;
-- Policy helper predicates must stay callable by API roles.
grant execute on function public.is_admin, public.is_restricted, public.is_active_member, public.is_semester_mod,
  public.shares_semester, public.post_semester to anon, authenticated;

-- ───────── Storage: one private bucket, no client policies → all file access goes through server routes ─────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('documents', 'documents', false, 10485760, array['application/pdf'])
  on conflict (id) do update set public = false;
-- Intentionally NO storage.objects policies for anon/authenticated: only the service role (server) can read/write.
