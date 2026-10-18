-- Chat: one room per group (live group chat) and 1:1 direct messages between classmates.
-- Security model: everything is enforced by Row Level Security + triggers, so it holds for ANY code path that writes.
--  * Group rooms are readable/writable only by active group members (live check, so removal revokes access at once).
--  * Direct rooms are visible only to their two participants; platform admins can NOT read direct messages.
--  * Direct rooms can only be opened between users who share an active group, and never when either has blocked the other.
--  * Edits: author only, within 24h. Deletes: author, or a moderator of that group. Deleted text is erased, not just hidden.
--  * Realtime: a trigger sends pg_notify('chat', {ids only}) — message text never travels over NOTIFY.
begin;

-- ───────── tables ─────────
create table public.chat_rooms (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('group','direct')),
  group_id uuid references public.groups(id) on delete cascade,
  direct_key text unique,                                    -- "<lower uuid>:<higher uuid>": one DM room per pair
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  check ((kind = 'group' and group_id is not null and direct_key is null) or (kind = 'direct' and group_id is null and direct_key is not null))
);
create unique index chat_rooms_one_per_group on public.chat_rooms (group_id) where kind = 'group';

create table public.chat_participants (                      -- read state; mandatory rows for DMs, lazy rows for group rooms
  room_id uuid not null references public.chat_rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  last_read_seq bigint not null default 0,
  muted boolean not null default false,
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);
create index on public.chat_participants (user_id);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  seq bigint generated always as identity,                   -- monotonic cursor for pagination / catch-up
  room_id uuid not null references public.chat_rooms(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text,
  reply_to uuid references public.chat_messages(id) on delete set null,
  client_id uuid,                                            -- idempotency key: a retried send never duplicates
  edited_at timestamptz,
  deleted_at timestamptz,
  deleted_by uuid,
  created_at timestamptz not null default now(),
  unique (room_id, sender_id, client_id),
  check ((deleted_at is null and char_length(body) between 1 and 2000) or (deleted_at is not null and body is null))
);
create unique index chat_messages_seq_key on public.chat_messages (seq);
create index chat_messages_room_seq on public.chat_messages (room_id, seq desc);

create table public.chat_reactions (
  message_id uuid not null references public.chat_messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null check (emoji in ('like','love','laugh','wow','thanks','party')),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, emoji)
);

create table public.user_blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index on public.user_blocks (blocked_id);

-- chat messages can be reported like any other content
alter table public.reports drop constraint if exists reports_target_type_check;
alter table public.reports add constraint reports_target_type_check
  check (target_type in ('document','post','comment','question','user','copyright','chat_message'));

-- ───────── predicates (SECURITY DEFINER avoids RLS recursion) ─────────
create or replace function public.is_blocked_pair(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from user_blocks where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a));
$$;
create or replace function public.can_access_room(r uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from chat_rooms c where c.id = r and (
      (c.kind = 'group' and (public.is_group_member(c.group_id) or public.is_admin()))                     -- admins moderate group chats…
   or (c.kind = 'direct' and exists (select 1 from chat_participants p where p.room_id = c.id and p.user_id = auth.uid()))));  -- …but never DMs
$$;
create or replace function public.can_send_room(r uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and not public.is_restricted() and exists (select 1 from chat_rooms c where c.id = r and (
      (c.kind = 'group' and public.is_group_member(c.group_id) and exists (select 1 from groups g where g.id = c.group_id and g.status = 'active'))
   or (c.kind = 'direct' and exists (select 1 from chat_participants p where p.room_id = c.id and p.user_id = auth.uid())
        and not exists (select 1 from chat_participants o where o.room_id = c.id and o.user_id <> auth.uid() and public.is_blocked_pair(auth.uid(), o.user_id)))));
$$;
create or replace function public.is_room_mod(r uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from chat_rooms c where c.id = r and c.kind = 'group' and (public.is_group_mod(c.group_id) or public.is_admin()));
$$;
create or replace function public.is_direct_room_member(r uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from chat_rooms c join chat_participants p on p.room_id = c.id where c.id = r and c.kind = 'direct' and p.user_id = auth.uid());
$$;
create or replace function public.chat_msg_room(m uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select room_id from chat_messages where id = m;
$$;
create or replace function public.shares_dm(other uuid) returns boolean   -- people you have a DM with can see each other's name
language sql stable security definer set search_path = public as $$
  select exists (select 1 from chat_participants a join chat_participants b on b.room_id = a.room_id and b.user_id = other
                 join chat_rooms c on c.id = a.room_id and c.kind = 'direct' where a.user_id = auth.uid());
$$;

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated
  using (id = auth.uid() or public.shares_group(id) or public.shares_dm(id) or public.is_admin());

-- ───────── triggers ─────────
create or replace function public.chat_room_for_group() returns trigger language plpgsql security definer set search_path = public as $$
begin insert into chat_rooms (kind, group_id) values ('group', new.id) on conflict do nothing; return new; end $$;
create trigger groups_chat_room after insert on public.groups for each row execute function public.chat_room_for_group();
insert into public.chat_rooms (kind, group_id) select 'group', id from public.groups on conflict do nothing;     -- backfill existing groups

create or replace function public.chat_messages_before_insert() returns trigger language plpgsql security definer set search_path = public as $$
declare r chat_rooms; other uuid;
begin
  select * into r from chat_rooms where id = new.room_id;
  if not found then raise exception 'room not found' using errcode = '23503'; end if;
  new.body := btrim(new.body);
  if new.body is null or char_length(new.body) = 0 then raise exception 'empty message' using errcode = '23514'; end if;
  if new.reply_to is not null and not exists (select 1 from chat_messages where id = new.reply_to and room_id = new.room_id) then
    raise exception 'reply target is not in this room' using errcode = '23514';
  end if;
  if r.kind = 'direct' then
    select user_id into other from chat_participants where room_id = r.id and user_id <> new.sender_id limit 1;
    if other is null or public.is_blocked_pair(new.sender_id, other) then raise exception 'cannot message this user' using errcode = '42501'; end if;
  end if;
  return new;
end $$;
create trigger chat_messages_bi before insert on public.chat_messages for each row execute function public.chat_messages_before_insert();

create or replace function public.chat_messages_after_insert() returns trigger language plpgsql security definer set search_path = public as $$
begin
  update chat_rooms set last_message_at = new.created_at where id = new.room_id;
  perform pg_notify('chat', jsonb_build_object('t','msg','room',new.room_id,'id',new.id,'seq',new.seq,'sender',new.sender_id)::text);
  return new;
end $$;
create trigger chat_messages_ai after insert on public.chat_messages for each row execute function public.chat_messages_after_insert();

-- Edit / delete rules, enforced in the database for every caller that has a user identity.
create or replace function public.chat_messages_before_update() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.id <> old.id or new.seq <> old.seq or new.room_id <> old.room_id or new.sender_id <> old.sender_id then
    raise exception 'protected message field' using errcode = '42501';                  -- immutable for everyone
  end if;
  if auth.uid() is null then return new; end if;                                       -- trusted server code (service role)
  if new.created_at <> old.created_at or new.client_id is distinct from old.client_id or new.reply_to is distinct from old.reply_to then
    raise exception 'protected message field' using errcode = '42501';                  -- locked for user sessions
  end if;
  if old.deleted_at is not null then raise exception 'message is deleted' using errcode = '42501'; end if;
  if new.deleted_at is not null then                                                  -- DELETE: author or group moderator
    if not (old.sender_id = auth.uid() or public.is_room_mod(old.room_id)) then raise exception 'not allowed' using errcode = '42501'; end if;
    new.body := null; new.deleted_by := auth.uid(); new.edited_at := old.edited_at;    -- the text is erased, not merely hidden
  elsif new.body is distinct from old.body then                                       -- EDIT: author only, 24h window
    if old.sender_id <> auth.uid() then raise exception 'only the author can edit' using errcode = '42501'; end if;
    if old.created_at < now() - interval '24 hours' then raise exception 'edit window has passed' using errcode = '42501'; end if;
    new.body := btrim(new.body);
    if new.body is null or char_length(new.body) = 0 then raise exception 'empty message' using errcode = '23514'; end if;
    new.edited_at := now();
  end if;
  return new;
end $$;
create trigger chat_messages_bu before update on public.chat_messages for each row execute function public.chat_messages_before_update();

create or replace function public.chat_messages_after_update() returns trigger language plpgsql security definer set search_path = public as $$
begin perform pg_notify('chat', jsonb_build_object('t','upd','room',new.room_id,'id',new.id,'seq',new.seq)::text); return new; end $$;
create trigger chat_messages_au after update on public.chat_messages for each row execute function public.chat_messages_after_update();

create or replace function public.chat_reactions_notify() returns trigger language plpgsql security definer set search_path = public as $$
declare m uuid := coalesce(new.message_id, old.message_id); rm uuid;
begin
  select room_id into rm from chat_messages where id = m;
  if rm is not null then perform pg_notify('chat', jsonb_build_object('t','upd','room',rm,'id',m)::text); end if;
  return coalesce(new, old);
end $$;
create trigger chat_reactions_an after insert or delete on public.chat_reactions for each row execute function public.chat_reactions_notify();

-- ───────── functions callable by signed-in users (they check auth.uid() themselves) ─────────
create or replace function public.chat_mark_read(p_room uuid, p_seq bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.can_access_room(p_room) then raise exception 'forbidden' using errcode = '42501'; end if;
  insert into chat_participants (room_id, user_id, last_read_seq) values (p_room, auth.uid(), greatest(p_seq, 0))
    on conflict (room_id, user_id) do update set last_read_seq = greatest(chat_participants.last_read_seq, excluded.last_read_seq);
end $$;

create or replace function public.chat_set_muted(p_room uuid, p_muted boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.can_access_room(p_room) then raise exception 'forbidden' using errcode = '42501'; end if;
  insert into chat_participants (room_id, user_id, muted) values (p_room, auth.uid(), p_muted)
    on conflict (room_id, user_id) do update set muted = excluded.muted;
end $$;

-- Unread counts per room for the current user (capped at 100 so a huge backlog stays cheap).
create or replace function public.chat_unread() returns table (room_id uuid, unread int, muted boolean)
language sql stable security definer set search_path = public as $$
  select c.id,
         (select count(*)::int from (select 1 from chat_messages m
            where m.room_id = c.id and m.sender_id <> auth.uid() and m.deleted_at is null
              and m.seq > coalesce(p.last_read_seq, 0)
              and (c.kind = 'direct' or p.user_id is not null or m.created_at > gm.joined_at)
            limit 100) q),
         coalesce(p.muted, false)
  from chat_rooms c
  left join chat_participants p on p.room_id = c.id and p.user_id = auth.uid()
  left join group_members gm on gm.group_id = c.group_id and gm.user_id = auth.uid() and gm.membership_status = 'active'
  where auth.uid() is not null and (
        (c.kind = 'group' and gm.user_id is not null)
     or (c.kind = 'direct' and p.user_id is not null));
$$;

-- ───────── trusted: open a DM (service role only) ─────────
create or replace function public.chat_open_direct(p_user uuid, p_other uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare k text; rid uuid;
begin
  if p_user = p_other then raise exception 'cannot message yourself' using errcode = '22023'; end if;
  if not exists (select 1 from profiles where id = p_other) then raise exception 'user not found' using errcode = '23503'; end if;
  if exists (select 1 from profiles where id = p_user and restricted_until > now()) then raise exception 'restricted' using errcode = '42501'; end if;
  if public.is_blocked_pair(p_user, p_other) then raise exception 'blocked' using errcode = '42501'; end if;
  k := least(p_user::text, p_other::text) || ':' || greatest(p_user::text, p_other::text);
  select id into rid from chat_rooms where direct_key = k;
  if rid is null then
    -- first contact only between classmates: both must be active members of at least one common group
    if not exists (select 1 from group_members a join group_members b on b.group_id = a.group_id
                   where a.user_id = p_user and b.user_id = p_other and a.membership_status = 'active' and b.membership_status = 'active') then
      raise exception 'you can only message people who share a group with you' using errcode = '42501';
    end if;
    insert into chat_rooms (kind, direct_key) values ('direct', k) on conflict (direct_key) do nothing returning id into rid;
    if rid is null then select id into rid from chat_rooms where direct_key = k; end if;
    insert into chat_participants (room_id, user_id) values (rid, p_user), (rid, p_other) on conflict do nothing;
  end if;
  return rid;
end $$;

-- ───────── privileges + RLS ─────────
alter table public.chat_rooms enable row level security;
alter table public.chat_participants enable row level security;
alter table public.chat_messages enable row level security;
alter table public.chat_reactions enable row level security;
alter table public.user_blocks enable row level security;
revoke all on public.chat_rooms, public.chat_participants, public.chat_messages, public.chat_reactions, public.user_blocks from anon, authenticated;
grant select on public.chat_rooms, public.chat_participants to authenticated;
grant select on public.chat_messages to authenticated;
grant insert (room_id, sender_id, body, reply_to, client_id) on public.chat_messages to authenticated;
grant update (body, deleted_at) on public.chat_messages to authenticated;
grant select, delete on public.chat_reactions to authenticated;
grant insert (message_id, user_id, emoji) on public.chat_reactions to authenticated;
grant select, delete on public.user_blocks to authenticated;
grant insert (blocker_id, blocked_id) on public.user_blocks to authenticated;

create policy chat_rooms_read on public.chat_rooms for select to authenticated using (public.can_access_room(id));
create policy chat_part_read on public.chat_participants for select to authenticated
  using (user_id = auth.uid() or public.is_direct_room_member(room_id));
create policy chat_msg_read on public.chat_messages for select to authenticated using (public.can_access_room(room_id));
create policy chat_msg_insert on public.chat_messages for insert to authenticated
  with check (sender_id = auth.uid() and public.can_send_room(room_id));
create policy chat_msg_update on public.chat_messages for update to authenticated
  using (sender_id = auth.uid() or public.is_room_mod(room_id)) with check (public.can_access_room(room_id));
create policy chat_react_read on public.chat_reactions for select to authenticated using (public.can_access_room(public.chat_msg_room(message_id)));
create policy chat_react_insert on public.chat_reactions for insert to authenticated
  with check (user_id = auth.uid() and public.can_send_room(public.chat_msg_room(message_id)));
create policy chat_react_delete on public.chat_reactions for delete to authenticated using (user_id = auth.uid());
create policy blocks_read on public.user_blocks for select to authenticated using (blocker_id = auth.uid());
create policy blocks_insert on public.user_blocks for insert to authenticated with check (blocker_id = auth.uid());
create policy blocks_delete on public.user_blocks for delete to authenticated using (blocker_id = auth.uid());

revoke all on function public.chat_mark_read, public.chat_set_muted, public.chat_unread, public.chat_open_direct,
  public.is_blocked_pair, public.can_access_room, public.can_send_room, public.is_room_mod, public.is_direct_room_member, public.chat_msg_room, public.shares_dm,
  public.chat_room_for_group, public.chat_messages_before_insert, public.chat_messages_after_insert, public.chat_messages_before_update,
  public.chat_messages_after_update, public.chat_reactions_notify from public, anon, authenticated;
grant execute on function public.chat_mark_read, public.chat_set_muted, public.chat_unread to authenticated;
grant execute on function public.can_access_room, public.can_send_room, public.is_room_mod, public.is_direct_room_member, public.chat_msg_room, public.shares_dm, public.is_blocked_pair to authenticated;
grant execute on function public.chat_open_direct to service_role;

commit;
