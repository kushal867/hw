-- Public content + events + saved notes (migration 0010). Runs inside a transaction that is rolled back.
\set ON_ERROR_STOP on
begin;
create or replace function pg_temp.as_user(u uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', coalesce(u::text,''), true); end $$;
create or replace function pg_temp.assert(cond boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(cond,false) then raise exception 'FAIL: %', msg; end if; end $$;
create or replace function pg_temp.denied(sql text, msg text, code text default null) returns void language plpgsql as $$
begin
  begin execute sql; exception when others then
    if code is not null and sqlstate <> code then raise exception 'FAIL (wrong error % instead of %): % -- %', sqlstate, code, msg, sqlerrm; end if;
    return;
  end;
  raise exception 'FAIL (was allowed): %', msg;
end $$;

-- A owns G1, B is a member, C is an outsider, X is a platform admin
insert into auth.users (id, email) values
 ('00000000-0000-0000-0000-00000000000a','a@x'),('00000000-0000-0000-0000-00000000000b','b@x'),('00000000-0000-0000-0000-00000000000c','c@x'),('00000000-0000-0000-0000-0000000000f1','x@x');
update profiles set platform_role = 'admin' where id = '00000000-0000-0000-0000-0000000000f1';
insert into colleges (id,name,city,slug) values ('10000000-0000-0000-0000-000000000001','Col','KTM','col');
insert into courses (id,college_id,name,slug) values ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','BIT','bit');
insert into semesters (id,course_id,semester_number) values ('30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',3);
insert into subjects (id,semester_id,name) values ('40000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','Data Structures & Algorithms'),
                                                  ('40000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000001','डाटा स्ट्रक्चर');
insert into groups (id,name,semester_id,visibility,join_policy) values ('50000000-0000-0000-0000-000000000001','Class','30000000-0000-0000-0000-000000000001','public','open');
insert into group_members (group_id,user_id,role) values
 ('50000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000a','owner'),
 ('50000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000b','member');
insert into documents (id,uploaded_by,group_id,subject_id,title,category,storage_path,size_bytes,mime_type,sha256) values
 ('60000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000a','50000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','Public notes','lecture_notes','p1',100,'application/pdf','h1'),
 ('60000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-00000000000a','50000000-0000-0000-0000-000000000001',null,'Private notes','lecture_notes','p2',100,'application/pdf','h2');
update documents set visibility='public', moderation_status='approved', published_at=now() where id='60000000-0000-0000-0000-000000000001';

-- ── slugs and public views ──
select pg_temp.assert(public.subject_slug('Data Structures & Algorithms', '40000000-0000-0000-0000-000000000001') = 'data-structures-algorithms', 'latin subject slug');
select pg_temp.assert(public.subject_slug('डाटा स्ट्रक्चर', '40000000-0000-0000-0000-000000000002') = 's-40000000', 'non-latin subject falls back to id prefix');
select pg_temp.assert((select subject_slug from public_notes where id='60000000-0000-0000-0000-000000000001') = 'data-structures-algorithms', 'public_notes exposes subject_slug');
select pg_temp.assert((select count(*) from public_notes) = 1, 'only the published note is in public_notes');
select pg_temp.assert((select course_slug from group_directory where id='50000000-0000-0000-0000-000000000001') = 'bit', 'group_directory exposes course_slug');
select pg_temp.assert((select view_count + download_count from public_notes where id='60000000-0000-0000-0000-000000000001') = 0, 'counters start at 0');

-- ── counters: only the trusted server may change them ──
set local role service_role;
select public.record_note_hit('60000000-0000-0000-0000-000000000001', 'view');
select public.record_note_hit('60000000-0000-0000-0000-000000000001', 'view');
select public.record_note_hit('60000000-0000-0000-0000-000000000001', 'download');
select public.record_note_hit('60000000-0000-0000-0000-000000000002', 'view');            -- private note: ignored
select pg_temp.assert((select view_count from documents where id='60000000-0000-0000-0000-000000000001') = 2, 'views counted');
select pg_temp.assert((select download_count from documents where id='60000000-0000-0000-0000-000000000001') = 1, 'downloads counted');
select pg_temp.assert((select view_count from documents where id='60000000-0000-0000-0000-000000000002') = 0, 'private notes are never counted');
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select pg_temp.denied($$select public.record_note_hit('60000000-0000-0000-0000-000000000001', 'view')$$, 'a user calling record_note_hit', '42501');
select pg_temp.denied($$update documents set view_count = 999999 where id='60000000-0000-0000-0000-000000000001'$$, 'uploader inflating views', '42501');
select pg_temp.denied($$update documents set download_count = 999999 where id='60000000-0000-0000-0000-000000000001'$$, 'uploader inflating downloads', '42501');

-- ── saved notes ──
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');                           -- an outsider may save a PUBLIC note
insert into note_saves (user_id, document_id) values ('00000000-0000-0000-0000-00000000000c', '60000000-0000-0000-0000-000000000001');
select pg_temp.denied($$insert into note_saves (user_id, document_id) values ('00000000-0000-0000-0000-00000000000c', '60000000-0000-0000-0000-000000000002')$$, 'saving a private note', '42501');
select pg_temp.denied($$insert into note_saves (user_id, document_id) values ('00000000-0000-0000-0000-00000000000a', '60000000-0000-0000-0000-000000000001')$$, 'saving as someone else', '42501');
select pg_temp.assert((select count(*) from note_saves) = 1, 'sees own save');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.assert((select count(*) from note_saves) = 0, 'saves are private to their owner');
delete from note_saves;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select pg_temp.assert((select count(*) from note_saves) = 1, 'another user cannot delete my save');
delete from note_saves where document_id = '60000000-0000-0000-0000-000000000001';
select pg_temp.assert((select count(*) from note_saves) = 0, 'owner can unsave');
reset role; set local role anon;
select pg_temp.denied($$select * from note_saves$$, 'anonymous reading saves', '42501');
reset role; set local role authenticated;

-- ── events: who may read / write ──
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
insert into group_events (group_id, title, kind, starts_at, created_by) values ('50000000-0000-0000-0000-000000000001', 'Midterm: Data Structures', 'exam', now() + interval '10 days', '00000000-0000-0000-0000-00000000000a');
select pg_temp.assert((select count(*) from group_events) = 1, 'owner creates and reads an event');
update group_events set title = 'Midterm: DSA', kind = 'exam' where title like 'Midterm%';
select pg_temp.assert((select title from group_events) = 'Midterm: DSA', 'owner edits an event');
select pg_temp.denied($$update group_events set reminded_at = now()$$, 'editing reminder bookkeeping', '42501');
select pg_temp.denied($$insert into group_events (group_id, title, starts_at, created_by) values ('50000000-0000-0000-0000-000000000001', 'x', now(), '00000000-0000-0000-0000-00000000000a')$$, 'title too short', '23514');
select pg_temp.denied($$insert into group_events (group_id, title, kind, starts_at, created_by) values ('50000000-0000-0000-0000-000000000001', 'Bad kind', 'party', now(), '00000000-0000-0000-0000-00000000000a')$$, 'unknown kind', '23514');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.assert((select count(*) from group_events) = 1, 'member can read the calendar');
select pg_temp.denied($$insert into group_events (group_id, title, kind, starts_at, created_by) values ('50000000-0000-0000-0000-000000000001', 'Member event', 'other', now(), '00000000-0000-0000-0000-00000000000b')$$, 'plain member creating an event', '42501');
select pg_temp.assert((select count(*) from (select 1 from group_events where false) q) = 0, 'sanity');
update group_events set title = 'hacked title here';
select pg_temp.assert((select title from group_events) = 'Midterm: DSA', 'member update affects nothing');
delete from group_events;
select pg_temp.assert((select count(*) from group_events) = 1, 'member delete affects nothing');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select pg_temp.assert((select count(*) from group_events) = 0, 'outsider cannot read the calendar');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f1');
select pg_temp.assert((select count(*) from group_events) = 1, 'platform admin can read for moderation');
reset role; set local role anon;
select pg_temp.denied($$select * from group_events$$, 'anonymous reading events', '42501');
reset role;

-- ── reminders ──
insert into group_events (group_id, title, kind, starts_at, created_by) values
 ('50000000-0000-0000-0000-000000000001', 'Quiz tomorrow', 'exam', now() + interval '3 hours', '00000000-0000-0000-0000-00000000000a'),
 ('50000000-0000-0000-0000-000000000001', 'Already started', 'class', now() - interval '1 hour', '00000000-0000-0000-0000-00000000000a');
set local role authenticated; select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select pg_temp.denied($$select public.run_event_reminders()$$, 'a user running the reminder job', '42501');
reset role; set local role service_role;
select pg_temp.assert(public.run_event_reminders() = 2, 'one reminder per active member for the event due within 24h (not the far-off or the past one)');
select pg_temp.assert(public.run_event_reminders() = 0, 'reminders are sent only once');
select pg_temp.assert((select count(*) from notifications where notification_type='event' and title like 'Exam coming up: Quiz tomorrow') = 2, 'members were notified');
select pg_temp.assert((select count(*) from group_events where reminded_at is not null) = 1, 'only the due event was marked');

rollback;
\echo CONTENT TESTS PASSED
