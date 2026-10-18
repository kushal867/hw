-- Chat security + behaviour. Runs inside a transaction that is rolled back.
\set ON_ERROR_STOP on
begin;
create or replace function pg_temp.as_user(u uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', coalesce(u::text,''), true); end $$;
create or replace function pg_temp.assert(cond boolean, msg text) returns void language plpgsql as $$
begin if not coalesce(cond,false) then raise exception 'FAIL: %', msg; end if; end $$;
-- Passes only if the statement fails. When `code` is given it must fail with exactly that SQLSTATE (so a typo can't fake a denial).
create or replace function pg_temp.denied(sql text, msg text, code text default null) returns void language plpgsql as $$
begin
  begin execute sql; exception when others then
    if code is not null and sqlstate <> code then raise exception 'FAIL (wrong error % instead of %): % -- %', sqlstate, code, msg, sqlerrm; end if;
    return;
  end;
  raise exception 'FAIL (was allowed): %', msg;
end $$;

-- users: A owner of G1, B member of G1, D member of G1, C outsider, E only in G2, X platform admin
insert into auth.users (id, email) values
 ('00000000-0000-0000-0000-00000000000a','a@x'),('00000000-0000-0000-0000-00000000000b','b@x'),('00000000-0000-0000-0000-00000000000c','c@x'),
 ('00000000-0000-0000-0000-00000000000d','d@x'),('00000000-0000-0000-0000-00000000000e','e@x'),('00000000-0000-0000-0000-0000000000f1','x@x');
update profiles set platform_role = 'admin' where id = '00000000-0000-0000-0000-0000000000f1';
insert into groups (id,name,visibility,join_policy) values
 ('50000000-0000-0000-0000-000000000001','Group One','public','open'),('50000000-0000-0000-0000-000000000002','Group Two','public','open');
insert into group_members (group_id,user_id,role) values
 ('50000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000a','owner'),
 ('50000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000b','member'),
 ('50000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000d','member'),
 ('50000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-00000000000e','owner');

select pg_temp.assert((select count(*) from chat_rooms where kind='group')=2, 'every group gets a chat room automatically');
create temp table ids as select (select id from chat_rooms where group_id='50000000-0000-0000-0000-000000000001') as g1room,
                                (select id from chat_rooms where group_id='50000000-0000-0000-0000-000000000002') as g2room;
grant select on ids to authenticated, service_role;
set local role authenticated;

-- ── group chat: send / read access ──
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
insert into chat_messages (room_id, sender_id, body, client_id) select g1room, '00000000-0000-0000-0000-00000000000b', '  hello class  ', '90000000-0000-0000-0000-000000000001' from ids;
select pg_temp.assert((select body from chat_messages where client_id='90000000-0000-0000-0000-000000000001')='hello class', 'body is trimmed');
select pg_temp.denied($$insert into chat_messages (room_id, sender_id, body, client_id) select g1room, '00000000-0000-0000-0000-00000000000b', 'dup', '90000000-0000-0000-0000-000000000001' from ids$$, 'same client_id twice must not duplicate', '23505');
select pg_temp.denied($$insert into chat_messages (room_id, sender_id, body) select g1room, '00000000-0000-0000-0000-00000000000a', 'spoof' from ids$$, 'sending as someone else', '42501');
select pg_temp.denied($$insert into chat_messages (room_id, sender_id, body) select g1room, '00000000-0000-0000-0000-00000000000b', '   ' from ids$$, 'blank message', '23514');
select pg_temp.denied($$insert into chat_messages (room_id, sender_id, body) select g1room, '00000000-0000-0000-0000-00000000000b', repeat('x', 2001) from ids$$, '2001 chars', '23514');
select pg_temp.denied($$insert into chat_messages (room_id, sender_id, body) select g2room, '00000000-0000-0000-0000-00000000000b', 'wrong group' from ids$$, 'non-member posting in another group', '42501');
select pg_temp.denied($$insert into chat_messages (room_id, sender_id, body, reply_to) select g2room, '00000000-0000-0000-0000-00000000000e', 'cross reply', (select id from chat_messages limit 1) from ids$$, 'reply to a message from another room', '23514');

select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');                       -- outsider
select pg_temp.assert((select count(*) from chat_messages)=0, 'outsider reads nothing');
select pg_temp.assert((select count(*) from chat_rooms)=0, 'outsider sees no rooms');
select pg_temp.denied($$insert into chat_messages (room_id, sender_id, body) select g1room, '00000000-0000-0000-0000-00000000000c', 'hi' from ids$$, 'outsider sending', '42501');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000f1');                       -- admin: may moderate group chats
select pg_temp.assert((select count(*) from chat_messages)=1, 'platform admin can read group chat for moderation');
select pg_temp.denied($$insert into chat_messages (room_id, sender_id, body) select g1room, '00000000-0000-0000-0000-0000000000f1', 'admin chat' from ids$$, 'admin who is not a member cannot post', '42501');

-- ── edit / delete ──
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
update chat_messages set body = 'hello everyone' where client_id='90000000-0000-0000-0000-000000000001';
select pg_temp.assert((select edited_at is not null from chat_messages where client_id='90000000-0000-0000-0000-000000000001'), 'edit marks edited_at');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');                       -- owner/moderator
select pg_temp.denied($$update chat_messages set body = 'tampered' where client_id='90000000-0000-0000-0000-000000000001'$$, 'moderator editing someone else''s text', '42501');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');                       -- plain member
update chat_messages set deleted_at = now() where client_id='90000000-0000-0000-0000-000000000001';
select pg_temp.assert((select deleted_at is null from chat_messages where client_id='90000000-0000-0000-0000-000000000001'), 'member cannot delete someone else''s message');
select pg_temp.denied($$update chat_messages set sender_id = '00000000-0000-0000-0000-00000000000d' where client_id='90000000-0000-0000-0000-000000000001'$$, 'changing protected columns', '42501');
reset role; select pg_temp.as_user(null); update chat_messages set created_at = now() - interval '25 hours' where client_id='90000000-0000-0000-0000-000000000001'; set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.denied($$update chat_messages set body = 'too late' where client_id='90000000-0000-0000-0000-000000000001'$$, 'editing after 24h', '42501');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');                       -- moderator deletes B's message
update chat_messages set deleted_at = now() where client_id='90000000-0000-0000-0000-000000000001';
select pg_temp.assert((select body is null and deleted_by = '00000000-0000-0000-0000-00000000000a' from chat_messages where client_id='90000000-0000-0000-0000-000000000001'), 'moderator delete erases the text and records who');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.denied($$update chat_messages set body = 'revive' where client_id='90000000-0000-0000-0000-000000000001'$$, 'editing a deleted message', '42501');

-- ── reactions ──
insert into chat_messages (room_id, sender_id, body, client_id) select g1room, '00000000-0000-0000-0000-00000000000b', 'react to me', '92000000-0000-0000-0000-000000000001' from ids;
create temp table rmsg as select id from chat_messages where client_id = '92000000-0000-0000-0000-000000000001'; grant select on rmsg to authenticated, service_role;
insert into chat_reactions (message_id, user_id, emoji) values ((select id from rmsg), '00000000-0000-0000-0000-00000000000b', 'like');
select pg_temp.denied($$insert into chat_reactions (message_id, user_id, emoji) values ((select id from rmsg), '00000000-0000-0000-0000-00000000000b', 'like')$$, 'duplicate reaction', '23505');
select pg_temp.denied($$insert into chat_reactions (message_id, user_id, emoji) values ((select id from rmsg), '00000000-0000-0000-0000-00000000000b', 'skull')$$, 'emoji outside the allowed set', '23514');
select pg_temp.denied($$insert into chat_reactions (message_id, user_id, emoji) values ((select id from rmsg), '00000000-0000-0000-0000-00000000000a', 'love')$$, 'reacting as another user', '42501');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select pg_temp.denied($$insert into chat_reactions (message_id, user_id, emoji) values ((select id from rmsg), '00000000-0000-0000-0000-00000000000c', 'like')$$, 'outsider reacting', '42501');
select pg_temp.assert((select count(*) from chat_reactions)=0, 'outsider cannot read reactions');

-- ── unread counts + read state ──
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
select pg_temp.assert((select unread from chat_unread() u join ids on u.room_id = ids.g1room) = 0, 'history before you joined / own view starts clean (member since fixture time)');
reset role; select pg_temp.as_user(null); update group_members set joined_at = now() - interval '1 day' where user_id='00000000-0000-0000-0000-00000000000d'; set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
select pg_temp.assert((select unread from chat_unread() u join ids on u.room_id = ids.g1room) = 1, 'D has 1 unread (deleted messages do not count)');
select chat_mark_read((select g1room from ids), (select max(seq) from chat_messages));
select pg_temp.assert((select unread from chat_unread() u join ids on u.room_id = ids.g1room) = 0, 'mark_read clears unread');
select chat_mark_read((select g1room from ids), 0);
select pg_temp.assert((select last_read_seq from chat_participants where user_id='00000000-0000-0000-0000-00000000000d') > 0, 'read marker never moves backwards');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select pg_temp.denied($$select chat_mark_read((select g1room from ids), 5)$$, 'outsider marking a room read', '42501');
select pg_temp.assert((select count(*) from chat_unread())=0, 'outsider has no rooms in unread');

-- ── direct messages ──
reset role; set local role service_role; select pg_temp.as_user(null);
create temp table dm as select chat_open_direct('00000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-00000000000b') as room;
grant select on dm to authenticated;
select pg_temp.assert(chat_open_direct('00000000-0000-0000-0000-00000000000b','00000000-0000-0000-0000-00000000000a') = (select room from dm), 'the same pair always gets the same room');
select pg_temp.denied($$select chat_open_direct('00000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-00000000000c')$$, 'DM to someone who shares no group', '42501');
select pg_temp.denied($$select chat_open_direct('00000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-00000000000a')$$, 'DM to yourself', '22023');
select pg_temp.denied($$select chat_open_direct('00000000-0000-0000-0000-00000000000e','00000000-0000-0000-0000-00000000000a')$$, 'DM across different groups', '42501');
select pg_temp.denied($$select chat_open_direct('00000000-0000-0000-0000-00000000000a','99999999-0000-0000-0000-000000000000')$$, 'DM to a user that does not exist', '23503');
reset role; set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
insert into chat_messages (room_id, sender_id, body) select room, '00000000-0000-0000-0000-00000000000a', 'private hello' from dm;
select pg_temp.assert((select name from (select display_name as name from profiles where id='00000000-0000-0000-0000-00000000000b') t) is not null, 'DM peers can see each other''s profile');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.assert((select count(*) from chat_messages m join dm on dm.room = m.room_id)=1, 'the other participant reads the DM');
select pg_temp.assert((select unread from chat_unread() u join dm on u.room_id = dm.room)=1, 'DM unread counted for the recipient');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');                       -- shares a group with both but is not in the DM
select pg_temp.assert((select count(*) from chat_messages m join dm on dm.room = m.room_id)=0, 'a third classmate cannot read a DM');
select pg_temp.denied($$insert into chat_messages (room_id, sender_id, body) select room, '00000000-0000-0000-0000-00000000000d', 'intrude' from dm$$, 'third party writing into a DM', '42501');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f1');                       -- admin
select pg_temp.assert((select count(*) from chat_messages m join dm on dm.room = m.room_id)=0, 'platform admins cannot read private DMs');
select pg_temp.assert((select count(*) from chat_rooms r join dm on dm.room = r.id)=0, 'platform admins cannot even see DM rooms');

-- ── blocking ──
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
insert into user_blocks (blocker_id, blocked_id) values ('00000000-0000-0000-0000-00000000000b','00000000-0000-0000-0000-00000000000a');
select pg_temp.denied($$insert into chat_messages (room_id, sender_id, body) select room, '00000000-0000-0000-0000-00000000000b', 'reply' from dm$$, 'blocker sending into the blocked DM', '42501');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select pg_temp.denied($$insert into chat_messages (room_id, sender_id, body) select room, '00000000-0000-0000-0000-00000000000a', 'are you there' from dm$$, 'blocked user sending', '42501');
select pg_temp.assert((select count(*) from user_blocks)=0, 'block list is private to the blocker');
reset role; set local role service_role; select pg_temp.as_user(null);
select pg_temp.denied($$select chat_open_direct('00000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-00000000000b')$$, 'opening a DM when blocked', '42501');
reset role; set local role authenticated; select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
delete from user_blocks where blocker_id='00000000-0000-0000-0000-00000000000b';
insert into chat_messages (room_id, sender_id, body) select room, '00000000-0000-0000-0000-00000000000b', 'sorry, unblocked' from dm;

-- ── group lifecycle ──
reset role; select pg_temp.as_user(null); update group_members set membership_status = 'removed' where user_id='00000000-0000-0000-0000-00000000000d'; set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
select pg_temp.assert((select count(*) from chat_messages m join ids on ids.g1room = m.room_id)=0, 'removed member loses access to the group chat immediately');
select pg_temp.denied($$insert into chat_messages (room_id, sender_id, body) select g1room, '00000000-0000-0000-0000-00000000000d', 'still here?' from ids$$, 'removed member sending', '42501');
reset role; select pg_temp.as_user(null); update groups set status = 'archived' where id='50000000-0000-0000-0000-000000000001'; set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.denied($$insert into chat_messages (room_id, sender_id, body) select g1room, '00000000-0000-0000-0000-00000000000b', 'archived' from ids$$, 'sending in an archived group', '42501');
select pg_temp.assert((select count(*) from chat_messages m join ids on ids.g1room = m.room_id)>0, 'archived group chat stays readable');

-- ── rate limiter: sliding window ──
reset role; select pg_temp.as_user(null); set local role service_role;
select pg_temp.assert(check_rate_limit('00000000-0000-0000-0000-00000000000a','rl-basic',3,3600) and check_rate_limit('00000000-0000-0000-0000-00000000000a','rl-basic',3,3600) and check_rate_limit('00000000-0000-0000-0000-00000000000a','rl-basic',3,3600) and not check_rate_limit('00000000-0000-0000-0000-00000000000a','rl-basic',3,3600), 'allows exactly max calls then blocks');
-- a nearly-full PREVIOUS window must still count: this is what stops the boundary burst a fixed window allows
reset role; insert into rate_limits (user_id, bucket, window_start, hits) values ('00000000-0000-0000-0000-00000000000a','rl-prev', to_timestamp(floor(extract(epoch from now())/86400)*86400) - interval '1 day', 1000000);
set local role service_role;
select pg_temp.assert(not check_rate_limit('00000000-0000-0000-0000-00000000000a','rl-prev',50,86400), 'previous window carries over (no 2x boundary burst)');
select pg_temp.assert(check_rate_limit('00000000-0000-0000-0000-00000000000e','rl-prev',50,86400), 'other users are unaffected');
reset role; set local role authenticated; select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.denied($$select check_rate_limit('00000000-0000-0000-0000-00000000000b','x',1,60)$$, 'users cannot call the rate limiter directly', '42501');

-- ── reports + restrictions ──
insert into reports (reporter_id, target_type, target_id, reason) values ('00000000-0000-0000-0000-00000000000b','chat_message',(select id from rmsg),'spam');
reset role; select pg_temp.as_user(null); update profiles set restricted_until = now() + interval '1 day' where id='00000000-0000-0000-0000-00000000000b'; set local role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.denied($$insert into chat_messages (room_id, sender_id, body) select room, '00000000-0000-0000-0000-00000000000b', 'restricted' from dm$$, 'restricted account sending a DM', '42501');
rollback;
\warn CHAT TESTS PASSED
