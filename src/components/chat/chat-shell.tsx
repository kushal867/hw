"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { BellOff, MessageSquarePlus, Search } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { GroupAvatar } from "@/components/group-avatar";
import { useChat } from "@/components/chat/chat-provider";
import { inboxTime } from "@/lib/chat/client-utils";
import type { InboxRoom } from "@/lib/chat/types";

/** Two-pane messenger: conversation list on the left, the open conversation on the right. On phones only one pane shows at a time. */
export function ChatShell({ rooms, children }: { rooms: InboxRoom[]; children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const { unread, subscribe } = useChat();
  const [q, setQ] = useState("");
  const inRoom = path !== "/chat";

  // New activity changes ordering/previews in the list (server-rendered), so refresh it — debounced.
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const off = subscribe({ onRoom: (e) => { if (e.t === "msg") { clearTimeout(t); t = setTimeout(() => router.refresh(), 700); } }, onResync: () => router.refresh() });
    return () => { off(); clearTimeout(t); };
  }, [subscribe, router]);

  const shown = useMemo(() => rooms.filter((r) => r.title.toLowerCase().includes(q.trim().toLowerCase())), [rooms, q]);

  return (
    <div className="card grid h-[calc(100dvh-13.5rem)] min-h-[420px] overflow-hidden lg:h-[calc(100dvh-8rem)] lg:grid-cols-[340px_minmax(0,1fr)]">
      <aside className={`min-h-0 flex-col border-r border-line ${inRoom ? "hidden lg:flex" : "flex"}`} aria-label="Conversations">
        <div className="flex items-center justify-between gap-2 px-4 pb-2 pt-4">
          <h1 className="text-xl font-extrabold">Chats</h1>
          <Link href="/chat/new" className="btn-secondary !min-h-[38px] !px-3" aria-label="New message"><MessageSquarePlus className="h-4 w-4" aria-hidden /><span className="text-sm">New</span></Link>
        </div>
        <div className="relative px-4 pb-3"><Search className="pointer-events-none absolute left-7 top-3.5 h-4 w-4 text-slate-500" aria-hidden />
          <label htmlFor="chat-search" className="sr-only">Search chats</label>
          <input id="chat-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search chats" className="input !min-h-[42px] rounded-full bg-slate-100/80 pl-10" /></div>
        <ul className="min-h-0 flex-1 divide-y divide-line/70 overflow-y-auto border-t border-line">
          {rooms.length === 0 && <li className="p-6 text-center text-sm leading-relaxed text-muted">No chats yet. Join a group to chat with its members, or <Link href="/chat/new" className="font-semibold text-brand-700 underline">message a classmate</Link>.</li>}
          {rooms.length > 0 && shown.length === 0 && <li className="p-6 text-center text-sm text-muted">No chats match “{q}”.</li>}
          {shown.map((r) => {
            const n = unread[r.id]?.n ?? r.unread;
            const muted = unread[r.id]?.muted ?? r.muted;
            const active = path === `/chat/${r.id}`;
            return (
              <li key={r.id}>
                <Link href={`/chat/${r.id}`} aria-current={active ? "page" : undefined} className={`flex items-center gap-3 px-4 py-3 transition ${active ? "bg-brand-50" : "hover:bg-slate-50"}`}>
                  {r.kind === "group" ? <GroupAvatar name={r.title} seed={r.avatarSeed} size={48} /> : <Avatar name={r.title} path={r.avatarPath} size={48} />}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2"><p className={`truncate ${n && !muted ? "font-extrabold" : "font-bold"}`}>{r.title}</p><span className={`shrink-0 text-[11px] ${n && !muted ? "font-bold text-brand-700" : "text-muted"}`}>{inboxTime(r.lastAt)}</span></div>
                    <div className="mt-0.5 flex items-center justify-between gap-2">
                      <p className={`truncate text-sm ${n && !muted ? "font-semibold text-ink" : "text-muted"}`}>
                        {r.lastDeleted ? <em>Message deleted</em> : r.lastBody ? <>{r.kind === "group" && r.lastSender ? <span className="text-slate-700">{r.lastSender.split(" ")[0]}: </span> : null}{r.lastBody}</> : <span className="italic">No messages yet</span>}</p>
                      <span className="flex shrink-0 items-center gap-1">{muted && <BellOff className="h-3.5 w-3.5 text-slate-500" aria-label="Muted" />}
                        {n > 0 && <span className={`grid min-w-[20px] place-items-center rounded-full px-1.5 text-[11px] font-bold leading-5 ${muted ? "bg-slate-200 text-slate-700" : "bg-brand-600 text-white"}`} aria-label={`${n >= 100 ? "99+" : n} unread`}>{n >= 100 ? "99+" : n}</span>}</span>
                    </div>
                  </div>
                </Link>
              </li>);
          })}
        </ul>
      </aside>
      <div className={`min-h-0 min-w-0 flex-col ${inRoom ? "flex" : "hidden lg:flex"}`}>{children}</div>
    </div>
  );
}
