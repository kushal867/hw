"use client";
import Link from "next/link";
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { AlertCircle, ArrowDown, ArrowLeft, Ban, Bell, BellOff, Check, Clock, CornerUpLeft, Flag, Loader2, MessageCircle, MoreHorizontal, Pencil, Send, ShieldOff, SmilePlus, Trash2, Users, X } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { GroupAvatar } from "@/components/group-avatar";
import { MessageText } from "@/components/chat/message-text";
import { useChat } from "@/components/chat/chat-provider";
import { clock, dayLabel, nameTone, sameDay, uuid } from "@/lib/chat/client-utils";
import { EDIT_WINDOW_MS, MAX_MESSAGE_LENGTH, REACTIONS, REACTION_KEYS, type ChatMessage, type ReactionKey, type RoomInfo } from "@/lib/chat/types";

type Me = { id: string; name: string; avatar: string | null };
type Props = { room: RoomInfo; me: Me; initial: { messages: ChatMessage[]; hasMore: boolean }; backHref?: string; embedded?: boolean };

class ApiFail extends Error { constructor(message: string, public status: number, public code?: string) { super(message); } }
async function api<T = any>(method: string, url: string, body?: unknown): Promise<T> {
  const r = await fetch(url, { method, cache: "no-store", headers: body !== undefined ? { "content-type": "application/json" } : undefined, body: body !== undefined ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => null);
  if (!r.ok) throw new ApiFail(j?.error?.message ?? "Something went wrong. Please try again.", r.status, j?.error?.code);
  return j as T;
}

const bySeq = (a: ChatMessage, b: ChatMessage) => (a.pending ? 1 : 0) - (b.pending ? 1 : 0) || (a.pending ? +new Date(a.createdAt) - +new Date(b.createdAt) : a.seq - b.seq);

export function ChatPanel({ room: initialRoom, me, initial, backHref, embedded = false }: Props) {
  const { subscribe, setActiveRoom, markRead, setMuted, live } = useChat();
  const [room, setRoom] = useState(initialRoom);
  const [msgs, setMsgs] = useState<ChatMessage[]>(initial.messages);
  const [hasMore, setHasMore] = useState(initial.hasMore);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [typing, setTyping] = useState<Record<string, { name: string; until: number }>>({});
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [editing, setEditing] = useState<ChatMessage | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [newBelow, setNewBelow] = useState(0);
  const [atBottom, setAtBottom] = useState(true);
  const [focusTick, setFocusTick] = useState(0);

  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const stick = useRef(true);
  const anchor = useRef<number | null>(null);
  const lastSeq = useRef(Math.max(0, ...initial.messages.map((m) => m.seq)));
  const lastMarked = useRef(initialRoom.lastReadSeq);
  const lastTyping = useRef(0);
  const catching = useRef(false);
  const again = useRef(false);
  const hasMoreRef = useRef(hasMore); hasMoreRef.current = hasMore;
  const firstSeq = useRef(0);

  const serverMsgs = useMemo(() => msgs.filter((m) => !m.pending && !m.failed), [msgs]);
  const maxSeq = serverMsgs.length ? serverMsgs[serverMsgs.length - 1].seq : 0;
  lastSeq.current = Math.max(lastSeq.current, maxSeq);
  firstSeq.current = serverMsgs.length ? serverMsgs[0].seq : 0;

  // Merge server messages in: replaces by id, drops optimistic copies that the server has confirmed (matched by clientId).
  const merge = useCallback((incoming: ChatMessage[]) => {
    if (!incoming.length) return;
    setMsgs((prev) => {
      const known = new Set(prev.map((m) => m.id));
      const clientIds = new Set(incoming.map((m) => m.clientId).filter(Boolean));
      const map = new Map(prev.filter((m) => !(m.pending && m.clientId && clientIds.has(m.clientId))).map((m) => [m.id, m] as const));
      let fresh = 0;
      for (const m of incoming) { if (!known.has(m.id) && m.sender?.id !== me.id) fresh++; map.set(m.id, m); }
      if (fresh && !stick.current) setNewBelow((n) => n + fresh);
      return [...map.values()].sort(bySeq);
    });
  }, [me.id]);

  const fetchMessages = useCallback((qs: string) => api<{ messages: ChatMessage[]; hasMore: boolean }>("GET", `/api/chat/rooms/${room.id}/messages?${qs}`), [room.id]);

  // Catch up: ask for everything after the last seen seq, with a small overlap (seq is assigned at insert, commits can land slightly out of order).
  const catchUp = useCallback(async () => {
    if (catching.current) { again.current = true; return; }
    catching.current = true;
    try {
      let cursor = Math.max(0, lastSeq.current - 25);
      for (let i = 0; i < 5; i++) {
        const j = await fetchMessages(`after=${cursor}&limit=100`);
        merge(j.messages);
        if (!j.hasMore || !j.messages.length) break;
        cursor = j.messages[j.messages.length - 1].seq;
      }
    } catch { /* transient: the next event or reconnect retries */ }
    finally { catching.current = false; if (again.current) { again.current = false; void catchUp(); } }
  }, [fetchMessages, merge]);

  const refetchOne = useCallback(async (id: string) => { try { merge((await fetchMessages(`id=${id}`)).messages); } catch { /* ignore */ } }, [fetchMessages, merge]);

  const loadOlder = useCallback(async () => {
    if (loadingOlder || !hasMoreRef.current || !firstSeq.current) return;
    setLoadingOlder(true);
    try {
      const el = listRef.current; if (el) anchor.current = el.scrollHeight - el.scrollTop;
      const j = await fetchMessages(`before=${firstSeq.current}&limit=30`);
      setHasMore(j.hasMore); merge(j.messages);
    } catch { toast.error("Couldn't load earlier messages."); anchor.current = null; }
    finally { setLoadingOlder(false); }
  }, [fetchMessages, loadingOlder, merge]);

  // Live events for this room
  useEffect(() => {
    setActiveRoom(room.id);
    const off = subscribe({
      onRoom: (e) => { if (e.room !== room.id) return; if (e.t === "msg") void catchUp(); else void refetchOne(e.id); },
      onTyping: (e) => { if (e.room === room.id) setTyping((t) => ({ ...t, [e.user]: { name: e.name, until: Date.now() + 5000 } })); },
      onResync: () => void catchUp(),
    });
    void catchUp();                                                     // the page may have been rendered a moment ago
    return () => { off(); setActiveRoom(null); };
  }, [room.id, subscribe, setActiveRoom, catchUp, refetchOne]);

  useEffect(() => {
    const id = setInterval(() => setTyping((t) => { const now = Date.now(); const keep = Object.entries(t).filter(([, v]) => v.until > now); return keep.length === Object.keys(t).length ? t : Object.fromEntries(keep); }), 1000);
    const onFocus = () => setFocusTick((n) => n + 1);
    window.addEventListener("focus", onFocus); document.addEventListener("visibilitychange", onFocus);
    return () => { clearInterval(id); window.removeEventListener("focus", onFocus); document.removeEventListener("visibilitychange", onFocus); };
  }, []);

  // Mark read once the newest message is on screen in a visible, focused tab.
  useEffect(() => {
    if (!maxSeq || maxSeq <= lastMarked.current || !atBottom) return;
    const t = setTimeout(() => { if (document.visibilityState === "visible" && document.hasFocus()) { lastMarked.current = maxSeq; markRead(room.id, maxSeq); } }, 500);
    return () => clearTimeout(t);
  }, [maxSeq, atBottom, focusTick, markRead, room.id]);

  // Scrolling: stay pinned to the bottom unless the reader scrolled up; keep position when older messages are prepended.
  useLayoutEffect(() => {
    const el = listRef.current; if (!el) return;
    if (anchor.current !== null) { el.scrollTop = el.scrollHeight - anchor.current; anchor.current = null; return; }
    if (stick.current) el.scrollTop = el.scrollHeight;
  }, [msgs]);
  useLayoutEffect(() => { const el = listRef.current; if (el) el.scrollTop = el.scrollHeight; }, []);

  const onScroll = () => {
    const el = listRef.current; if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    stick.current = near; setAtBottom(near); if (near) setNewBelow(0);
    if (el.scrollTop < 100) void loadOlder();
  };
  const jumpToBottom = () => { const el = listRef.current; if (el) { el.scrollTo({ top: el.scrollHeight, behavior: "smooth" }); stick.current = true; setNewBelow(0); } };

  // ───── sending ─────
  const post = useCallback(async (temp: ChatMessage) => {
    try {
      const j = await api<{ message: ChatMessage }>("POST", `/api/chat/rooms/${room.id}/messages`, { body: temp.body, clientId: temp.clientId, replyTo: temp.replyTo?.id ?? null });
      merge([j.message]);
    } catch (e: any) {
      const hard = e instanceof ApiFail && e.status < 500 && e.status !== 429 && e.code !== "rate_limited";
      setMsgs((p) => p.map((m) => (m.id === temp.id ? { ...m, pending: false, failed: true } : m)));
      toast.error(e?.message ?? "Message not sent.");
      if (hard && e.code === "duplicate") setMsgs((p) => p.filter((m) => m.id !== temp.id));
    }
  }, [merge, room.id]);

  const submit = async () => {
    const value = text.trim();
    if (!value || !room.canSend) return;
    if ([...value].length > MAX_MESSAGE_LENGTH) { toast.error(`Messages are limited to ${MAX_MESSAGE_LENGTH} characters.`); return; }
    if (editing) {
      const target = editing; setEditing(null); setText("");
      try { const j = await api<{ message: ChatMessage }>("PATCH", `/api/chat/messages/${target.id}`, { body: value }); merge([j.message]); }
      catch (e: any) { toast.error(e.message); }
      return;
    }
    const clientId = uuid();
    const temp: ChatMessage = {
      id: `tmp-${clientId}`, seq: Number.MAX_SAFE_INTEGER, roomId: room.id, clientId, body: value, pending: true,
      sender: { id: me.id, name: me.name, avatar: me.avatar },
      replyTo: replyTo ? { id: replyTo.id, senderName: replyTo.sender?.name ?? null, preview: replyTo.body ? replyTo.body.slice(0, 90) : null, deleted: false } : null,
      createdAt: new Date().toISOString(), editedAt: null, deletedAt: null, reactions: [],
    };
    stick.current = true; setMsgs((p) => [...p, temp].sort(bySeq)); setText(""); setReplyTo(null);
    void post(temp);
  };
  const retry = (m: ChatMessage) => { const temp = { ...m, pending: true, failed: false }; setMsgs((p) => p.map((x) => (x.id === m.id ? temp : x))); void post(temp); };

  const onType = (v: string) => {
    setText(v);
    if (v && Date.now() - lastTyping.current > 3000 && room.canSend && !editing) { lastTyping.current = Date.now(); void api("POST", `/api/chat/rooms/${room.id}/typing`).catch(() => {}); }
  };
  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Escape") { setReplyTo(null); if (editing) { setEditing(null); setText(""); } return; }
    const coarse = typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;      // on phones Enter = new line, button sends
    if (e.key === "Enter" && !e.shiftKey && !coarse && !e.nativeEvent.isComposing) { e.preventDefault(); void submit(); }
  };
  useEffect(() => { const el = inputRef.current; if (el) { el.style.height = "auto"; el.style.height = `${Math.min(el.scrollHeight, 140)}px`; } }, [text]);

  // ───── message actions ─────
  const react = useCallback(async (m: ChatMessage, emoji: ReactionKey) => {
    const mine = m.reactions.find((r) => r.emoji === emoji)?.mine ?? false;
    setMsgs((p) => p.map((x) => {
      if (x.id !== m.id) return x;
      const cur = x.reactions.find((r) => r.emoji === emoji);
      const next = cur ? x.reactions.map((r) => (r.emoji === emoji ? { ...r, count: r.count + (mine ? -1 : 1), mine: !mine } : r)).filter((r) => r.count > 0) : [...x.reactions, { emoji, count: 1, mine: true }];
      return { ...x, reactions: next };
    }));
    try { const j = await api<{ message: ChatMessage | null }>("PUT", `/api/chat/messages/${m.id}/reactions`, { emoji, on: !mine }); if (j.message) merge([j.message]); }
    catch (e: any) { toast.error(e.message); void refetchOne(m.id); }
  }, [merge, refetchOne]);

  const remove = useCallback(async (m: ChatMessage) => {
    if (!window.confirm("Delete this message for everyone?")) return;
    try { const j = await api<{ message: ChatMessage }>("DELETE", `/api/chat/messages/${m.id}`); merge([j.message]); }
    catch (e: any) { toast.error(e.message); }
  }, [merge]);

  const startEdit = useCallback((m: ChatMessage) => { setEditing(m); setReplyTo(null); setText(m.body ?? ""); setSelected(null); setTimeout(() => inputRef.current?.focus(), 0); }, []);
  const startReply = useCallback((m: ChatMessage) => { setReplyTo(m); setEditing(null); setSelected(null); setTimeout(() => inputRef.current?.focus(), 0); }, []);
  const dropFailed = useCallback((m: ChatMessage) => setMsgs((p) => p.filter((x) => x.id !== m.id)), []);

  const toggleMute = async () => {
    const muted = !room.muted;
    try { await api("PUT", `/api/chat/rooms/${room.id}/mute`, { muted }); setRoom((r) => ({ ...r, muted })); setMuted(room.id, muted); toast.success(muted ? "Notifications muted." : "Notifications on."); }
    catch (e: any) { toast.error(e.message); }
  };
  const toggleBlock = async () => {
    if (!room.otherUserId) return;
    const blocked = !room.blockedByMe;
    if (blocked && !window.confirm(`Block ${room.title}? Neither of you will be able to send messages in this chat.`)) return;
    try {
      await api("PUT", "/api/chat/blocks", { userId: room.otherUserId, blocked });
      setRoom((r) => ({ ...r, blockedByMe: blocked, canSend: !blocked, sendBlockedReason: blocked ? "You blocked this person. Unblock them to send a message." : null }));
      toast.success(blocked ? `${room.title} is blocked.` : `${room.title} is unblocked.`);
    } catch (e: any) { toast.error(e.message); }
  };

  const typers = Object.values(typing).map((t) => t.name);
  const typingText = typers.length === 0 ? "" : typers.length === 1 ? `${typers[0]} is typing…` : typers.length === 2 ? `${typers[0]} and ${typers[1]} are typing…` : "Several people are typing…";
  const count = [...text].length;

  return (
    <section className="flex h-full min-h-0 flex-col bg-surface" aria-label={`Chat: ${room.title}`}>
      <header className="flex items-center gap-3 border-b border-line px-3 py-3 sm:px-4">
        {backHref && <Link href={backHref} className="btn-ghost !min-h-[40px] !px-2.5 lg:hidden" aria-label="Back to chats"><ArrowLeft className="h-5 w-5" aria-hidden /></Link>}
        {room.kind === "group" ? <GroupAvatar name={room.title} seed={room.avatarSeed} size={40} /> : <Avatar name={room.title} path={room.avatarPath} size={40} />}
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-bold leading-tight">{room.title}</h2>
          <p className="truncate text-xs text-muted" aria-live="polite">{typingText ? <span className="font-semibold text-brand-700">{typingText}</span> : room.subtitle}</p>
        </div>
        {live === "offline" && <span className="badge-warn" role="status">Reconnecting…</span>}
        <details className="relative">
          <summary className="btn-ghost !min-h-[40px] !px-2.5 cursor-pointer list-none [&::-webkit-details-marker]:hidden" aria-label="Chat options"><MoreHorizontal className="h-5 w-5" aria-hidden /></summary>
          <div className="absolute right-0 top-full z-30 mt-1 w-60 rounded-2xl border border-line bg-surface p-1.5 shadow-pop">
            {room.groupId && <Link href={`/groups/${room.groupId}`} className={menuItem}><Users className="h-4 w-4" aria-hidden />Open group page</Link>}
            <button onClick={toggleMute} className={menuItem}>{room.muted ? <Bell className="h-4 w-4" aria-hidden /> : <BellOff className="h-4 w-4" aria-hidden />}{room.muted ? "Turn notifications on" : "Mute notifications"}</button>
            {room.kind === "direct" && <button onClick={toggleBlock} className={`${menuItem} ${room.blockedByMe ? "" : "text-red-600 hover:!bg-red-50"}`}>{room.blockedByMe ? <ShieldOff className="h-4 w-4" aria-hidden /> : <Ban className="h-4 w-4" aria-hidden />}{room.blockedByMe ? `Unblock ${room.title}` : `Block ${room.title}`}</button>}
          </div>
        </details>
      </header>

      <div className="relative min-h-0 flex-1">
        <div ref={listRef} onScroll={onScroll} role="log" aria-live="polite" aria-relevant="additions" aria-label="Messages" className="h-full overflow-y-auto overscroll-contain bg-slate-50/60 px-3 py-4 sm:px-5">
          {loadingOlder && <p className="flex items-center justify-center gap-2 py-2 text-xs text-muted"><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />Loading earlier messages…</p>}
          {!hasMore && msgs.length > 0 && <p className="py-3 text-center text-xs text-muted">This is the beginning of the conversation.</p>}
          {msgs.length === 0 && (
            <div className="grid h-full place-items-center px-4 text-center"><div className="max-w-sm">
              <span className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-gradient-to-br from-brand-500 to-violet-500 text-white shadow-pop"><MessageCircle className="h-7 w-7" aria-hidden /></span>
              <p className="mt-4 text-lg font-extrabold">{room.kind === "group" ? "Start the conversation" : `Say hi to ${room.title}`}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted">{room.canSend
                ? (room.kind === "group" ? "Chat with everyone in this group in real time. Only members can read these messages." : "Messages here are private between the two of you.")
                : room.sendBlockedReason}</p>
              {room.canSend && (
                <div className="mt-5 flex flex-wrap justify-center gap-2" role="group" aria-label="Conversation starters">
                  {(room.kind === "group" ? ["👋 Hi everyone!", "📚 Is anyone sharing notes?", "❓ I have a question"] : ["👋 Hi!", "📚 Do you have the notes?"]).map((s) => (
                    <button key={s} type="button" onClick={() => { onType(s); inputRef.current?.focus(); }}
                      className="rounded-full border border-line bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-card transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700">{s}</button>))}
                </div>)}
            </div></div>)}
          <ul className="space-y-0.5">
            {msgs.map((m, i) => {
              const prev = msgs[i - 1];
              const newDay = !prev || !sameDay(prev.createdAt, m.createdAt);
              const cluster = !!prev && !newDay && prev.sender?.id === m.sender?.id && !prev.deletedAt && +new Date(m.createdAt) - +new Date(prev.createdAt) < 5 * 60_000;
              const nextSame = msgs[i + 1] && msgs[i + 1].sender?.id === m.sender?.id && sameDay(msgs[i + 1].createdAt, m.createdAt) && +new Date(msgs[i + 1].createdAt) - +new Date(m.createdAt) < 5 * 60_000;
              return (
                <li key={m.id} className={cluster ? "pt-0.5" : "pt-3"}>
                  {newDay && <div className="my-3 flex items-center justify-center"><span className="rounded-full bg-white px-3 py-1 text-[11px] font-bold text-slate-600 shadow-card ring-1 ring-line">{dayLabel(m.createdAt)}</span></div>}
                  <MessageRow m={m} mine={m.sender?.id === me.id} showHead={!cluster} showTime={!nextSame} group={room.kind === "group"} selected={selected === m.id}
                    canReact={room.canSend} canMod={room.isMod} onSelect={setSelected} onReply={startReply} onReact={react} onEdit={startEdit} onDelete={remove} onRetry={retry} onDrop={dropFailed} />
                </li>);
            })}
          </ul>
        </div>
        {newBelow > 0 && <button onClick={jumpToBottom} className="btn-primary absolute bottom-3 left-1/2 -translate-x-1/2 !min-h-[36px] rounded-full px-4 text-xs shadow-pop"><ArrowDown className="h-4 w-4" aria-hidden />{newBelow} new message{newBelow > 1 ? "s" : ""}</button>}
        {!atBottom && newBelow === 0 && <button onClick={jumpToBottom} className="btn-secondary absolute bottom-3 right-4 !min-h-[38px] !w-[38px] rounded-full !px-0 shadow-pop" aria-label="Scroll to latest message"><ArrowDown className="h-4 w-4" aria-hidden /></button>}
      </div>

      <footer className="border-t border-line bg-surface p-3 sm:p-4">
        {!room.canSend ? (
          <p className="flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-700"><Ban className="h-4 w-4 shrink-0" aria-hidden />{room.sendBlockedReason ?? "You can't send messages here."}
            {room.kind === "direct" && room.blockedByMe && <button onClick={toggleBlock} className="ml-auto font-bold text-brand-700 underline">Unblock</button>}</p>
        ) : (<>
          {(replyTo || editing) && (
            <div className="mb-2 flex items-center gap-3 rounded-xl border-l-4 border-brand-500 bg-brand-50/70 px-3 py-2 text-sm">
              {editing ? <Pencil className="h-4 w-4 shrink-0 text-brand-700" aria-hidden /> : <CornerUpLeft className="h-4 w-4 shrink-0 text-brand-700" aria-hidden />}
              <div className="min-w-0 flex-1"><p className="text-xs font-bold text-brand-700">{editing ? "Editing message" : `Replying to ${replyTo!.sender?.name ?? "message"}`}</p>
                <p className="truncate text-slate-600">{(editing ?? replyTo)!.body}</p></div>
              <button onClick={() => { setReplyTo(null); setEditing(null); if (editing) setText(""); }} className="btn-ghost !min-h-[32px] !px-2" aria-label="Cancel"><X className="h-4 w-4" aria-hidden /></button>
            </div>)}
          <div className="flex items-end gap-2 rounded-[28px] border border-line bg-slate-50 p-1.5 pl-4 transition focus-within:border-brand-400 focus-within:bg-white focus-within:shadow-[0_0_0_4px_rgba(79,70,229,0.12)]">
            <label htmlFor={`composer-${room.id}`} className="sr-only">Message {room.title}</label>
            <textarea id={`composer-${room.id}`} ref={inputRef} value={text} rows={1} maxLength={MAX_MESSAGE_LENGTH * 2} onChange={(e) => onType(e.target.value)} onKeyDown={onKeyDown}
              placeholder={editing ? "Edit your message…" : room.kind === "group" ? "Message the group…" : `Message ${room.title}…`} className="max-h-36 min-h-[40px] flex-1 resize-none border-0 bg-transparent py-2.5 text-[15px] leading-snug text-ink outline-none placeholder:text-slate-500 focus:ring-0 focus-visible:!outline-none" />
            <button onClick={() => void submit()} disabled={!text.trim()} className="btn-primary !min-h-[42px] !w-[42px] shrink-0 rounded-full !px-0 disabled:!bg-slate-200 disabled:!text-slate-500 disabled:shadow-none" aria-label={editing ? "Save edit" : "Send message"}>{editing ? <Check className="h-5 w-5" aria-hidden /> : <Send className="h-5 w-5" aria-hidden />}</button>
          </div>
          <div className="mt-1.5 flex items-center justify-between px-1 text-[11px] text-muted"><span className="hidden sm:inline">Enter to send · Shift+Enter for a new line</span>{count > MAX_MESSAGE_LENGTH - 200 && <span className={count > MAX_MESSAGE_LENGTH ? "font-bold text-red-600" : ""}>{count}/{MAX_MESSAGE_LENGTH}</span>}</div>
        </>)}
      </footer>
    </section>
  );
}

const menuItem = "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-100";

type RowProps = {
  m: ChatMessage; mine: boolean; showHead: boolean; showTime: boolean; group: boolean; selected: boolean; canReact: boolean; canMod: boolean;
  onSelect: (id: string | null) => void; onReply: (m: ChatMessage) => void; onReact: (m: ChatMessage, e: ReactionKey) => void; onEdit: (m: ChatMessage) => void;
  onDelete: (m: ChatMessage) => void; onRetry: (m: ChatMessage) => void; onDrop: (m: ChatMessage) => void;
};

const MessageRow = memo(function MessageRow({ m, mine, showHead, showTime, group, selected, canReact, canMod, onSelect, onReply, onReact, onEdit, onDelete, onRetry, onDrop }: RowProps) {
  const [picker, setPicker] = useState(false);
  const deleted = !!m.deletedAt;
  const editable = mine && !deleted && !m.pending && !m.failed && Date.now() - +new Date(m.createdAt) < EDIT_WINDOW_MS;
  const canDelete = !deleted && !m.pending && !m.failed && (mine || canMod);
  const name = m.sender?.name ?? "Deleted user";

  if (deleted) return (
    <div className={`flex ${mine ? "justify-end" : "justify-start gap-2"}`}>
      {!mine && <span className="w-8 shrink-0" />}
      <p className="flex items-center gap-1.5 rounded-2xl border border-dashed border-slate-300 px-3.5 py-2 text-sm italic text-slate-600"><Ban className="h-3.5 w-3.5" aria-hidden />Message deleted</p>
    </div>);

  return (
    <article aria-label={`${name}, ${clock(m.createdAt)}`} className={`group relative flex ${mine ? "justify-end" : "justify-start gap-2"}`}>
      {!mine && (showHead ? <Avatar name={name} path={m.sender?.avatar} size={32} /> : <span className="w-8 shrink-0" />)}
      <div className={`flex max-w-[82%] flex-col sm:max-w-[70%] ${mine ? "items-end" : "items-start"}`}>
        {showHead && !mine && group && <p className={`mb-0.5 px-1 text-xs font-bold ${nameTone(m.sender?.id ?? "")}`}>{name}</p>}
        <div className="relative">
          <div role="button" tabIndex={0} onClick={() => onSelect(selected ? null : m.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(selected ? null : m.id); } }}
            className={`cursor-default rounded-2xl px-3.5 py-2 text-[15px] leading-relaxed shadow-sm outline-offset-2 ${mine ? "rounded-br-md bg-brand-600 text-white" : "rounded-bl-md bg-white text-ink ring-1 ring-line"} ${m.pending ? "opacity-70" : ""} ${m.failed ? "ring-2 ring-red-300" : ""}`}>
            {m.replyTo && (
              <div className={`mb-1.5 rounded-lg border-l-4 px-2.5 py-1.5 text-xs ${mine ? "border-white/70 bg-white/15" : "border-brand-500 bg-slate-50"}`}>
                <p className={`font-bold ${mine ? "text-white" : "text-brand-700"}`}>{m.replyTo.senderName ?? "Message"}</p>
                <p className={`line-clamp-2 ${mine ? "text-indigo-50" : "text-slate-600"}`}>{m.replyTo.deleted ? "Message deleted" : m.replyTo.preview}</p>
              </div>)}
            <MessageText text={m.body ?? ""} className={mine ? "[&_a]:text-white" : "[&_a]:text-brand-700"} />
          </div>
          <div className={`absolute -top-4 z-10 items-center gap-0.5 rounded-xl border border-line bg-surface p-0.5 text-slate-700 shadow-pop ${mine ? "right-2" : "left-2"} ${selected || picker ? "flex" : "hidden group-hover:flex group-focus-within:flex"}`}>
              {!m.pending && !m.failed && <>
                {canReact && <button className={tool} onClick={() => setPicker((v) => !v)} aria-label="Add reaction" aria-expanded={picker} title="React"><SmilePlus className="h-4 w-4" aria-hidden /></button>}
                {canReact && <button className={tool} onClick={() => onReply(m)} aria-label="Reply" title="Reply"><CornerUpLeft className="h-4 w-4" aria-hidden /></button>}
                {editable && <button className={tool} onClick={() => onEdit(m)} aria-label="Edit message" title="Edit"><Pencil className="h-4 w-4" aria-hidden /></button>}
                {canDelete && <button className={`${tool} hover:!text-red-600`} onClick={() => onDelete(m)} aria-label="Delete message" title="Delete"><Trash2 className="h-4 w-4" aria-hidden /></button>}
                {!mine && <Link className={tool} href={`/report-content?type=chat_message&id=${m.id}`} aria-label="Report message" title="Report"><Flag className="h-4 w-4" aria-hidden /></Link>}
              </>}
            </div>
          {picker && (
            <div className={`absolute -top-14 z-20 flex gap-1 rounded-2xl border border-line bg-surface p-1.5 shadow-pop ${mine ? "right-2" : "left-2"}`} role="group" aria-label="Choose a reaction">
              {REACTION_KEYS.map((k) => <button key={k} onClick={() => { setPicker(false); onSelect(null); onReact(m, k); }} className="grid h-9 w-9 place-items-center rounded-xl text-xl transition hover:scale-125 hover:bg-slate-100" aria-label={`React ${k}`}>{REACTIONS[k]}</button>)}
            </div>)}
        </div>

        {m.reactions.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">{m.reactions.map((r) => (
            <button key={r.emoji} onClick={() => canReact && onReact(m, r.emoji)} aria-pressed={r.mine} aria-label={`${r.emoji} reaction, ${r.count}`}
              className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold transition ${r.mine ? "border-brand-300 bg-brand-50 text-brand-700" : "border-line bg-white text-slate-600 hover:bg-slate-50"}`}><span>{REACTIONS[r.emoji]}</span>{r.count}</button>))}</div>)}

        {(showTime || m.pending || m.failed) && (
          <p className={`mt-0.5 flex items-center gap-1.5 px-1 text-[11px] ${m.failed ? "font-semibold text-red-600" : "text-muted"}`}>
            {m.failed ? <><AlertCircle className="h-3 w-3" aria-hidden />Not sent <button onClick={() => onRetry(m)} className="font-bold underline">Retry</button> · <button onClick={() => onDrop(m)} className="font-bold underline">Remove</button></>
              : m.pending ? <><Clock className="h-3 w-3" aria-hidden />Sending…</>
              : <>{clock(m.createdAt)}{m.editedAt && <span>· edited</span>}</>}
          </p>)}
      </div>
    </article>
  );
});
const tool = "grid h-8 w-8 place-items-center rounded-lg hover:bg-slate-100 focus-visible:bg-slate-100";
