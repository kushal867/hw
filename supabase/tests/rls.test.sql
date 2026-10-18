-- Run against a DB with all migrations applied (see scripts/test-db.sh). Any failed assertion aborts with an error.
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

-- ids: users a (owner of G1), b (member of G1), c (outsider), d (creates groups)
-- fixtures (as superuser)
insert into auth.users (id, email) values
 ('00000000-0000-0000-0000-00000000000a','a@x'),('00000000-0000-0000-0000-00000000000b','b@x'),
 ('00000000-0000-0000-0000-00000000000c','c@x'),('00000000-0000-0000-0000-00000000000d','d@x');
insert into colleges (id,name,city,slug) values ('10000000-0000-0000-0000-000000000001','Col','KTM','col');
insert into courses (id,college_id,name,slug) values ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','BIT','bit');
insert into semesters (id,course_id,semester_number) values
 ('30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',1),
 ('30000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001',2);
insert into subjects (id,semester_id,name) values
 ('40000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','Programming'),
 ('40000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000002','Math');
-- G1: private, invite-only, linked to semester 1. G2: public, open, unlinked. G3: public, approval.
insert into groups (id,name,semester_id,visibility,join_policy) values
 ('50000000-0000-0000-0000-000000000001','Private class',  '30000000-0000-0000-0000-000000000001','private','invite_only'),
 ('50000000-0000-0000-0000-000000000002','Open hw group',  null,'public','open'),
 ('50000000-0000-0000-0000-000000000003','Approval group', null,'public','approval');
insert into group_members (group_id,user_id,role) values
 ('50000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000a','owner'),
 ('50000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000b','member'),
 ('50000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-00000000000a','owner'),
 ('50000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-00000000000a','owner');
insert into documents (id,uploaded_by,group_id,title,category,storage_path,size_bytes,mime_type,sha256) values
 ('60000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000a','50000000-0000-0000-0000-000000000001','Private notes','lecture_notes','p1',100,'application/pdf','h1');
insert into discussion_posts (id,group_id,subject_id,author_id,title,body) values
 ('70000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000b','hello','body');

set local role authenticated;

-- ── Non-member C: sees public group rows but nothing private ──
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select pg_temp.assert((select count(*) from documents)=0, 'outsider must not see documents');
select pg_temp.assert((select count(*) from group_members)=0, 'outsider must not see rosters');
select pg_temp.assert((select count(*) from discussion_posts)=0, 'outsider must not read private discussions');
select pg_temp.assert((select count(*) from public_notes)=0, 'private doc must not be in public_notes');
select pg_temp.assert((select count(*) from groups where id='50000000-0000-0000-0000-000000000001')=0, 'private group row is hidden from outsiders');
select pg_temp.assert((select count(*) from groups where visibility='public')=2, 'public group rows are visible');
select pg_temp.assert((select count(*) from group_directory)=2, 'directory lists only public groups');
select pg_temp.assert((select count(*) from group_directory where name='Private class')=0, 'private group never in directory');
select pg_temp.denied($$insert into discussion_posts(group_id,author_id,title,body) values ('50000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000c','hello','x')$$, 'outsider posting');
select pg_temp.denied($$insert into group_members values ('50000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-00000000000c','owner','active',now())$$, 'self-insert as owner');
select pg_temp.denied($$insert into groups(name) values ('Sneaky group')$$, 'direct group insert (must use create_group)');
update groups set name='Hijacked' where id='50000000-0000-0000-0000-000000000002';
select pg_temp.assert((select name from groups where id='50000000-0000-0000-0000-000000000002')='Open hw group','group name unchanged by non-owner');
select pg_temp.assert((select count(*) from colleges)=1, 'hierarchy is publicly browsable');

-- ── Member B reads, cannot escalate ──
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.assert((select count(*) from documents)=1, 'member sees group docs');
select pg_temp.assert((select count(*) from group_members where group_id='50000000-0000-0000-0000-000000000001')=2, 'member sees roster');
select pg_temp.denied($$update group_members set role='owner' where user_id='00000000-0000-0000-0000-00000000000b'$$, 'self-promote to owner');
select pg_temp.denied($$update profiles set platform_role='admin' where id='00000000-0000-0000-0000-00000000000b'$$, 'self-promote to admin');
select pg_temp.denied($$update documents set visibility='public', moderation_status='approved'$$, 'member self-publishing');
select pg_temp.denied($$update documents set moderation_status='approved'$$, 'member self-approving');
update groups set name='Member rename' where id='50000000-0000-0000-0000-000000000001';
select pg_temp.assert((select name from groups where id='50000000-0000-0000-0000-000000000001')='Private class','member cannot edit group settings');
select pg_temp.denied($$insert into exam_questions(group_id,subject_id,created_by,question_text,question_type) values ('50000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000b','What is OOP?','teacher_confirmed')$$, 'self-labelled teacher_confirmed');
select pg_temp.denied($$insert into discussion_posts(group_id,subject_id,author_id,title,body) values ('50000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-00000000000b','hello','x')$$, 'subject from a different semester than the group');
select pg_temp.denied($$insert into discussion_posts(group_id,subject_id,author_id,title,body) values ('50000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000b','hello','x')$$, 'subject tag on an unlinked group');
insert into exam_questions(group_id,created_by,question_text) values ('50000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000b','Explain polymorphism');  -- subject optional
delete from group_members where user_id='00000000-0000-0000-0000-00000000000a';
select pg_temp.assert((select count(*) from group_members where group_id='50000000-0000-0000-0000-000000000001')=2, 'owner row survives member delete attempt');
select pg_temp.denied($$insert into audit_logs(action) values ('x')$$, 'audit insert');
select pg_temp.denied($$select redeem_invite('x', '00000000-0000-0000-0000-00000000000b')$$, 'user calling redeem_invite');
select pg_temp.denied($$select create_group('00000000-0000-0000-0000-00000000000b','x group',null,null,'public','open')$$, 'user calling create_group directly');
select pg_temp.denied($$select join_group('00000000-0000-0000-0000-00000000000b','50000000-0000-0000-0000-000000000002')$$, 'user calling join_group directly');
select pg_temp.denied($$select set_member_role('00000000-0000-0000-0000-00000000000b','50000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000b','owner')$$, 'user calling set_member_role');

-- ── Outsider cannot read/comment on private group content ──
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select pg_temp.denied($$insert into discussion_comments(post_id,author_id,body) values ('70000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000c','hi')$$, 'outsider commenting');
select pg_temp.assert((select count(*) from profiles where id='00000000-0000-0000-0000-00000000000b')=0, 'outsider must not read other profiles');

-- ── Notifications / reports isolation ──
reset role; select pg_temp.as_user(null);
insert into notifications(user_id,notification_type,title) values ('00000000-0000-0000-0000-00000000000b','x','for B');
insert into reports(reporter_id,target_type,target_id,reason) values ('00000000-0000-0000-0000-00000000000b','document','60000000-0000-0000-0000-000000000001','spam');
set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select pg_temp.assert((select count(*) from notifications)=0, 'C cannot read B notifications');
select pg_temp.assert((select count(*) from reports)=0, 'C cannot read B reports');

-- ── Public publication path ──
reset role; select pg_temp.as_user(null);
update documents set visibility='public', moderation_status='approved', published_at=now() where id='60000000-0000-0000-0000-000000000001';
set local role anon;
select pg_temp.assert((select count(*) from public_notes)=1, 'approved doc appears publicly');
select pg_temp.assert((select count(*) from group_directory)=2, 'anon sees the public directory');
select pg_temp.denied($$select count(*) from documents$$, 'anon has no direct access to documents');
select pg_temp.denied($$select count(*) from groups$$, 'anon has no direct access to groups table');
select pg_temp.denied($$select storage_path from public_notes$$, 'storage_path never exposed');
select pg_temp.denied($$select group_name from public_notes$$, 'private group name never exposed via public notes');

-- ── Any student can create groups (service-role function) ──
reset role;
select pg_temp.denied($$update group_members set role='member' where user_id='00000000-0000-0000-0000-00000000000a' and group_id='50000000-0000-0000-0000-000000000001'$$, 'demoting last owner');
set local role service_role;
select pg_temp.as_user(null);
do $$ declare gid uuid; begin
  gid := create_group('00000000-0000-0000-0000-00000000000d','Maths homework','Share hw',null,'public','open');
  perform pg_temp.assert((select role from group_members where group_id=gid and user_id='00000000-0000-0000-0000-00000000000d')='owner','creator becomes owner');
  perform pg_temp.assert((select visibility from groups where id=gid)='public','group created public');
  -- private forces invite_only whatever policy is requested
  gid := create_group('00000000-0000-0000-0000-00000000000d','Secret circle',null,null,'private','open');
  perform pg_temp.assert((select join_policy from groups where id=gid)='invite_only','private groups are always invite-only');
  -- linked to a semester enables subject tagging
  gid := create_group('00000000-0000-0000-0000-00000000000d','BIT sem 2 hw',null,'30000000-0000-0000-0000-000000000002','public','approval');
  perform pg_temp.assert((select semester_id from groups where id=gid)='30000000-0000-0000-0000-000000000002','semester link stored');
end $$;
select pg_temp.denied($$select create_group('00000000-0000-0000-0000-00000000000d','ab',null,null,'public','open')$$, 'name too short');
-- ownership cap (20)
do $$ begin for i in 1..20 loop
  begin perform create_group('00000000-0000-0000-0000-00000000000d','Group '||i,null,null,'public','open'); exception when others then null; end;
end loop; end $$;
select pg_temp.assert((select count(*) from group_members where user_id='00000000-0000-0000-0000-00000000000d' and role='owner')=20,'owner limit enforced at 20');

-- ── join_group: open / approval / private ──
select pg_temp.assert(join_group('00000000-0000-0000-0000-00000000000c','50000000-0000-0000-0000-000000000002')->>'status'='joined','open public group joins immediately');
select pg_temp.assert(join_group('00000000-0000-0000-0000-00000000000c','50000000-0000-0000-0000-000000000002')->>'status'='already_member','no duplicate membership');
select pg_temp.assert(join_group('00000000-0000-0000-0000-00000000000c','50000000-0000-0000-0000-000000000003')->>'status'='pending','approval group makes a pending request');
select pg_temp.assert(join_group('00000000-0000-0000-0000-00000000000c','50000000-0000-0000-0000-000000000001')->>'status'='invalid','private group cannot be joined without invite');
reset role;
set local role authenticated; select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select pg_temp.assert((select count(*) from group_members where group_id='50000000-0000-0000-0000-000000000003' and user_id <> '00000000-0000-0000-0000-00000000000c')=0, 'pending member cannot see the roster (only their own request)');
reset role; select pg_temp.as_user(null);
-- owner approves the pending request
set local role service_role;
select decide_join_request('00000000-0000-0000-0000-00000000000a','50000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-00000000000c',true);
select pg_temp.assert((select membership_status from group_members where group_id='50000000-0000-0000-0000-000000000003' and user_id='00000000-0000-0000-0000-00000000000c')='active','owner approval activates member');
select pg_temp.denied($$select decide_join_request('00000000-0000-0000-0000-00000000000c','50000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-00000000000b',true)$$, 'non-mod approving');

-- ── Invites ──
select pg_temp.assert(redeem_invite('nope','00000000-0000-0000-0000-00000000000c')->>'status'='invalid','unknown token invalid');
reset role;
insert into group_invites(group_id,token_hash,created_by,expires_at,max_uses) values
 ('50000000-0000-0000-0000-000000000001','ok','00000000-0000-0000-0000-00000000000a',now()+interval '1 day',1),
 ('50000000-0000-0000-0000-000000000001','expired','00000000-0000-0000-0000-00000000000a',now()-interval '1 day',5),
 ('50000000-0000-0000-0000-000000000001','revoked','00000000-0000-0000-0000-00000000000a',now()+interval '1 day',5);
update group_invites set revoked_at=now() where token_hash='revoked';
set local role service_role;
select pg_temp.assert(redeem_invite('expired','00000000-0000-0000-0000-00000000000c')->>'status'='invalid','expired invite');
select pg_temp.assert(redeem_invite('revoked','00000000-0000-0000-0000-00000000000c')->>'status'='invalid','revoked invite');
select pg_temp.assert(redeem_invite('ok','00000000-0000-0000-0000-00000000000c')->>'status'='joined','valid invite joins a PRIVATE group');
select pg_temp.assert(redeem_invite('ok','00000000-0000-0000-0000-00000000000d')->>'status'='invalid','max_uses exhausted');
select pg_temp.assert((select used_count from group_invites where token_hash='ok')=1,'used_count counted once');
select pg_temp.assert(check_rate_limit('00000000-0000-0000-0000-00000000000c','t',2,60) and check_rate_limit('00000000-0000-0000-0000-00000000000c','t',2,60) and not check_rate_limit('00000000-0000-0000-0000-00000000000c','t',2,60),'rate limit');

-- ── Ownership transfer keeps exactly one owner ──
select set_member_role('00000000-0000-0000-0000-00000000000a','50000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000b','owner');
select pg_temp.assert((select count(*) from group_members where group_id='50000000-0000-0000-0000-000000000001' and role='owner')=1,'single owner after transfer');
select pg_temp.denied($$select set_member_role('00000000-0000-0000-0000-00000000000a','50000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000a','owner')$$, 'former owner cannot act as owner');
select pg_temp.denied($$select remove_member('00000000-0000-0000-0000-00000000000a','50000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000b')$$, 'moderator removing the owner');

-- ── Owner can edit own group settings (as the user) but not protected fields ──
reset role; set local role authenticated; select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
update groups set name='Renamed by owner', description='new' where id='50000000-0000-0000-0000-000000000001';
select pg_temp.assert((select name from groups where id='50000000-0000-0000-0000-000000000001')='Renamed by owner','owner edits group');
select pg_temp.denied($$update groups set status='archived' where id='50000000-0000-0000-0000-000000000001'$$, 'owner changing protected status');
select pg_temp.denied($$update groups set visibility='private', join_policy='open' where id='50000000-0000-0000-0000-000000000001'$$, 'private + open violates constraint');
rollback;
\warn ALL RLS TESTS PASSED
