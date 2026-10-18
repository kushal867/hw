import "server-only";
import { clientFor, userSql } from "@/lib/db";
import { preview } from "@/lib/chat/sanitize";
import type { ChatMessage, InboxRoom, ReactionKey, RoomInfo } from "@/lib/chat/types";
import { REACTION_KEYS } from "@/lib/chat/types";

const SENDER = "profiles!chat_messages_sender_id_fkey";
export const MESSAGE_SELECT =
  `id,seq,room_id,sender_id,body,reply_to,client_id,created_at,edited_at,deleted_at,${SENDER}(display_name,avatar_path),` +
  `reply:chat_messages!chat_messages_reply_to_fkey(id,body,deleted_at,${SENDER}(display_name)),chat_reactions(emoji,user_id)`;

/** Turns a database row into the shape the UI uses. */
export function shapeMessage(row: any, meId: string): ChatMessage {
  const counts = new Map<ReactionKey, { count: number; mine: boolean }>();
  for (const r of row.chat_reactions ?? []) {
    if (!REACTION_KEYS.includes(r.emoji)) continue;
    const c = counts.get(r.emoji as ReactionKey) ?? { count: 0, mine: false };
    c.count++; c.mine ||= r.user_id === meId; counts.set(r.emoji, c);
  }
  const reply = row.reply;
  return {
    id: row.id, seq: Number(row.seq), roomId: row.room_id, clientId: row.client_id ?? null,
    sender: row.profiles ? { id: row.sender_id, name: row.profiles.display_name, avatar: row.profiles.avatar_path ?? null } : null,
    body: row.deleted_at ? null : row.body,
    replyTo: reply ? { id: reply.id, senderName: reply.profiles?.display_name ?? null, preview: reply.deleted_at ? null : preview(reply.body), deleted: !!reply.deleted_at } : null,
    createdAt: row.created_at, editedAt: row.edited_at ?? null, deletedAt: row.deleted_at ?? null,
    reactions: [...counts.entries()].map(([emoji, v]) => ({ emoji, ...v })),
  };
}

export type ListOpts = { before?: number; after?: number; id?: string; limit?: number };

/** Messages for a room, always through RLS as `userId`. Returns ascending order. `before` pages backwards, `after` catches up. */
export async function listMessages(userId: string, roomId: string, opts: ListOpts = {}): Promise<{ messages: ChatMessage[]; hasMore: boolean }> {
  const limit = Math.min(Math.max(opts.limit ?? 30, 1), 100);
  let q = clientFor(userId).from("chat_messages").select(MESSAGE_SELECT).eq("room_id", roomId);
  let rows: any[];
  let hasMore = false;
  if (opts.id) {
    const r = await q.eq("id", opts.id);
    rows = r.data ?? [];
  } else if (opts.after !== undefined) {
    const r = await q.gt("seq", opts.after).order("seq", { ascending: true }).limit(limit + 1);
    rows = r.data ?? []; hasMore = rows.length > limit; rows = rows.slice(0, limit);
  } else {
    if (opts.before !== undefined) q = q.lt("seq", opts.before);
    const r = await q.order("seq", { ascending: false }).limit(limit + 1);
    rows = r.data ?? []; hasMore = rows.length > limit; rows = rows.slice(0, limit).reverse();
  }
  return { messages: rows.map((r) => shapeMessage(r, userId)), hasMore };
}

/** Everything the chat header/composer needs to know about a room, or null if the user can't see it. */
export async function getRoomInfo(userId: string, roomId: string): Promise<RoomInfo | null> {
  const db = clientFor(userId);
  const { data: room } = await db.from("chat_rooms")
    .select("id,kind,group_id,groups(id,name,status),chat_participants(user_id,muted,last_read_seq,profiles(display_name,avatar_path))").eq("id", roomId).maybeSingle();
  if (!room) return null;
  const parts: any[] = room.chat_participants ?? [];
  const mine = parts.find((p) => p.user_id === userId);
  const [{ ok = false } = {}] = await userSql<{ ok: boolean }>(userId, "select public.can_send_room($1) as ok", [roomId]);
  const [{ mod = false } = {}] = await userSql<{ mod: boolean }>(userId, "select public.is_room_mod($1) as mod", [roomId]);
  if (room.kind === "group") {
    const archived = room.groups?.status === "archived";
    return {
      id: room.id, kind: "group", title: room.groups?.name ?? "Group chat", subtitle: "Group chat", avatarSeed: room.group_id, avatarPath: null,
      groupId: room.group_id, otherUserId: null, canSend: ok, blockedByMe: false, muted: !!mine?.muted, isMod: mod, lastReadSeq: Number(mine?.last_read_seq ?? 0),
      sendBlockedReason: ok ? null : archived ? "This group is archived, so the chat is read-only." : "You can read this chat but only members can send messages.",
    };
  }
  const other = parts.find((p) => p.user_id !== userId);
  const { data: blocks } = other ? await db.from("user_blocks").select("blocked_id").eq("blocked_id", other.user_id) : { data: [] };
  const blockedByMe = !!blocks?.length;
  return {
    id: room.id, kind: "direct", title: other?.profiles?.display_name ?? "Student", subtitle: "Direct message", avatarSeed: other?.user_id ?? room.id,
    avatarPath: other?.profiles?.avatar_path ?? null, groupId: null, otherUserId: other?.user_id ?? null, canSend: ok, blockedByMe, muted: !!mine?.muted, isMod: false,
    lastReadSeq: Number(mine?.last_read_seq ?? 0),
    sendBlockedReason: ok ? null : blockedByMe ? "You blocked this person. Unblock them to send a message." : "You can't send messages to this person.",
  };
}

/** The chat inbox: group chats of groups you belong to + your DMs, newest activity first. Runs under RLS as the user. */
export async function listInbox(userId: string): Promise<InboxRoom[]> {
  const rows = await userSql<any>(userId, `
    select r.id, r.kind, r.group_id, g.name as group_name, coalesce(r.last_message_at, r.created_at) as sort_at,
           lm.body as last_body, lm.deleted_at as last_deleted, lm.created_at as last_at, sp.display_name as last_sender,
           op.id as other_id, op.display_name as other_name, op.avatar_path as other_avatar, u.unread, u.muted
    from public.chat_unread() u
    join public.chat_rooms r on r.id = u.room_id
    left join public.groups g on g.id = r.group_id
    left join lateral (select m.body, m.deleted_at, m.created_at, m.sender_id from public.chat_messages m where m.room_id = r.id order by m.seq desc limit 1) lm on true
    left join public.profiles sp on sp.id = lm.sender_id
    left join lateral (select p.user_id from public.chat_participants p where p.room_id = r.id and p.user_id <> $1 limit 1) oth on r.kind = 'direct'
    left join public.profiles op on op.id = oth.user_id
    where g.status is distinct from 'archived'
    order by sort_at desc limit 100`, [userId]);
  return rows.map((r): InboxRoom => ({
    id: r.id, kind: r.kind, groupId: r.group_id,
    title: r.kind === "group" ? r.group_name : r.other_name ?? "Student", avatarSeed: r.kind === "group" ? r.group_id : r.other_id ?? r.id,
    avatarPath: r.kind === "direct" ? r.other_avatar ?? null : null,
    lastBody: r.last_deleted ? null : r.last_body ? preview(r.last_body, 70) : null, lastSender: r.last_sender ?? null, lastAt: r.last_at ?? null,
    lastDeleted: !!r.last_deleted, unread: Number(r.unread ?? 0), muted: !!r.muted,
  }));
}

export async function unreadFor(userId: string) {
  return (await userSql<{ room_id: string; unread: number; muted: boolean }>(userId, "select room_id, unread, muted from public.chat_unread()")).map((r) => ({ roomId: r.room_id, unread: Number(r.unread), muted: r.muted }));
}

export async function roomIdForGroup(userId: string, groupId: string): Promise<string | null> {
  const { data } = await clientFor(userId).from("chat_rooms").select("id").eq("group_id", groupId).maybeSingle();
  return data?.id ?? null;
}
