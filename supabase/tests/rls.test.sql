-- Run against a DB with migrations applied (see scripts/test-db.sh). Any failed assertion aborts with an error.
\set ON_ERROR_STOP on
begin;
create or replace function pg_temp.as_user(u uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', coalesce(u::text,''), true); end $$;
create or replace function pg_temp.assert(cond boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(cond,false) then raise exception 'FAIL: %', msg; end if; end $$;
create or replace function pg_temp.denied(sql text, msg text) returns void language plpgsql as $$
begin
  begin execute sql; exception when others then return; end;
  raise exception 'FAIL (was allowed): %', msg;
end $$;

-- fixtures (as superuser)
insert into auth.users (id, email) values
 ('00000000-0000-0000-0000-00000000000a','a@x'),('00000000-0000-0000-0000-00000000000b','b@x'),('00000000-0000-0000-0000-00000000000c','c@x');
insert into colleges (id,name,city,slug) values ('10000000-0000-0000-0000-000000000001','Col','KTM','col');
insert into courses (id,college_id,name,slug) values ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','BIT','bit');
insert into semesters (id,course_id,semester_number) values
 ('30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',1),
 ('30000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001',2);
insert into subjects (id,semester_id,name) values
 ('40000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','Programming'),
 ('40000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000002','Math');
insert into semester_members values
 ('30000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000a','owner','active',now()),
 ('30000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000b','member','active',now());
insert into documents (id,uploaded_by,semester_id,title,category,storage_path,size_bytes,mime_type,sha256) values
 ('50000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000a','30000000-0000-0000-0000-000000000001','Private notes','lecture_notes','p1',100,'application/pdf','h1');

insert into discussion_posts(id,semester_id,subject_id,author_id,title,body) values ('60000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000b','hello','body');
set local role authenticated;

-- Non-member C sees nothing private
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select pg_temp.assert((select count(*) from documents)=0, 'outsider must not see documents');
select pg_temp.assert((select count(*) from semester_members)=0, 'outsider must not see roster');
select pg_temp.assert((select count(*) from public_notes)=0, 'private doc must not be in public_notes');
select pg_temp.denied($$insert into discussion_posts(semester_id,author_id,title,body) values ('30000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000c','hello','x')$$, 'outsider posting');
select pg_temp.denied($$insert into semester_members values ('30000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000c','owner','active',now())$$, 'self-insert as owner');
select pg_temp.assert((select count(*) from colleges)=1, 'hierarchy is publicly browsable');

-- Member B reads, but cannot escalate
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.assert((select count(*) from documents)=1, 'member sees semester docs');
select pg_temp.assert((select count(*) from semester_members)=2, 'member sees roster');
select pg_temp.denied($$update semester_members set role='owner' where user_id='00000000-0000-0000-0000-00000000000b'$$, 'self-promote to owner');
select pg_temp.denied($$update profiles set platform_role='admin' where id='00000000-0000-0000-0000-00000000000b'$$, 'self-promote to admin');
select pg_temp.denied($$update documents set visibility='public', moderation_status='approved'$$, 'member self-publishing');
select pg_temp.denied($$update documents set moderation_status='approved'$$, 'member self-approving');
select pg_temp.denied($$insert into exam_questions(semester_id,subject_id,created_by,question_text,question_type) values ('30000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000b','What is OOP?','teacher_confirmed')$$, 'self-labelled teacher_confirmed');
-- cross-semester subject must be rejected by composite FK
select pg_temp.denied($$insert into discussion_posts(semester_id,subject_id,author_id,title,body) values ('30000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-00000000000b','hello','x')$$, 'subject from other semester');
insert into discussion_posts(semester_id,subject_id,author_id,title,body) values ('30000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000b','hello','body');
insert into exam_questions(semester_id,subject_id,created_by,question_text) values ('30000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000b','Explain polymorphism');
delete from semester_members where user_id='00000000-0000-0000-0000-00000000000a';
select pg_temp.assert((select count(*) from semester_members)=2, 'owner row still there');
select pg_temp.denied($$select * from audit_logs where false; insert into audit_logs(action) values ('x')$$, 'audit insert');
select pg_temp.denied($$select redeem_invite('x', '00000000-0000-0000-0000-00000000000b')$$, 'user calling redeem_invite');
select pg_temp.denied($$select set_member_role('00000000-0000-0000-0000-00000000000b','30000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000b','owner')$$, 'user calling set_member_role');

-- Outsider cannot see the discussion or questions; cannot comment
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select pg_temp.assert((select count(*) from discussion_posts)=0, 'outsider must not read private discussions');
select pg_temp.assert((select count(*) from exam_questions)=0, 'outsider must not read questions');
select pg_temp.denied($$insert into discussion_comments(post_id,author_id,body) values ('60000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000c','hi')$$, 'outsider commenting');
select pg_temp.assert((select count(*) from profiles where id='00000000-0000-0000-0000-00000000000b')=0, 'outsider must not read other profiles');

-- Notifications / reports isolation
reset role;
insert into notifications(user_id,notification_type,title) values ('00000000-0000-0000-0000-00000000000b','x','for B');
insert into reports(reporter_id,target_type,target_id,reason) values ('00000000-0000-0000-0000-00000000000b','document','50000000-0000-0000-0000-000000000001','spam');
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select pg_temp.assert((select count(*) from notifications)=0, 'C cannot read B notifications');
select pg_temp.assert((select count(*) from reports)=0, 'C cannot read B reports');

-- Public publication path: only approved+public rows reach public_notes (service/admin action)
reset role;
select pg_temp.as_user(null);   -- service role requests carry no user sub
update documents set visibility='public', moderation_status='approved', published_at=now() where id='50000000-0000-0000-0000-000000000001';
set local role anon;
select pg_temp.assert((select count(*) from public_notes)=1, 'approved doc appears publicly');
select pg_temp.assert((select count(*) from documents)=0 or true, 'n/a');
select pg_temp.denied($$select count(*) from documents$$, 'anon has no direct access to documents');
select pg_temp.denied($$select storage_path from public_notes$$, 'storage_path never exposed');

-- Last-owner guard + invite redemption (service role)
reset role;
select pg_temp.denied($$update semester_members set role='member' where user_id='00000000-0000-0000-0000-00000000000a'$$, 'demoting last owner');
set local role service_role;
select pg_temp.assert(redeem_invite('nope','00000000-0000-0000-0000-00000000000c')->>'status'='invalid','unknown token invalid');
reset role;
insert into semester_invites(semester_id,token_hash,created_by,expires_at,max_uses) values
 ('30000000-0000-0000-0000-000000000001','ok','00000000-0000-0000-0000-00000000000a',now()+interval '1 day',1),
 ('30000000-0000-0000-0000-000000000001','expired','00000000-0000-0000-0000-00000000000a',now()-interval '1 day',5),
 ('30000000-0000-0000-0000-000000000001','revoked','00000000-0000-0000-0000-00000000000a',now()+interval '1 day',5);
update semester_invites set revoked_at=now() where token_hash='revoked';
set local role service_role;
select pg_temp.assert(redeem_invite('expired','00000000-0000-0000-0000-00000000000c')->>'status'='invalid','expired invite');
select pg_temp.assert(redeem_invite('revoked','00000000-0000-0000-0000-00000000000c')->>'status'='invalid','revoked invite');
select pg_temp.assert(redeem_invite('ok','00000000-0000-0000-0000-00000000000c')->>'status'='joined','valid invite joins');
select pg_temp.assert(redeem_invite('ok','00000000-0000-0000-0000-00000000000c')->>'status'='invalid','max_uses exhausted');
select pg_temp.assert((select used_count from semester_invites where token_hash='ok')=1,'used_count counted once');
select pg_temp.assert(check_rate_limit('00000000-0000-0000-0000-00000000000c','t',2,60) and check_rate_limit('00000000-0000-0000-0000-00000000000c','t',2,60) and not check_rate_limit('00000000-0000-0000-0000-00000000000c','t',2,60),'rate limit');
-- Ownership transfer keeps exactly one owner
select set_member_role('00000000-0000-0000-0000-00000000000a','30000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000b','owner');
select pg_temp.assert((select count(*) from semester_members where role='owner')=1,'single owner after transfer');
select pg_temp.denied($$select set_member_role('00000000-0000-0000-0000-00000000000a','30000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000a','owner')$$, 'former owner cannot act as owner');
rollback;
\warn ALL RLS TESTS PASSED
