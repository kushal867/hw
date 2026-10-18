"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { StreamEvent } from "@/lib/chat/types";

type Unread = Record<string, { n: number; muted: boolean }>;
type RoomEvent = Extract<StreamEvent, { t: "msg" | "upd" }>;
type TypingEvent = Extract<StreamEvent, { t: "typing" }>;
export type Handlers = { onRoom?: (e: RoomEvent) => void; onTyping?: (e: TypingEvent) => void; onResync?: () => void };
export type LiveState = "connecting" | "live" | "offline";

type Ctx = {
  unread: Unread; totalUnread: number; live: LiveState; userId: string;
  subscribe: (h: Handlers) => () => void;
  setActiveRoom: (roomId: string | null) => void;
  markRead: (roomId: string, seq: number) => void;
  setMuted: (roomId: string, muted: boolean) => void;
};
const ChatCtx = createContext<Ctx | null>(null);

export function useChat() {
  const c = useContext(ChatCtx);
  if (!c) throw new Error("useChat must be used inside <ChatProvider>");
  return c;
}
/** Same as useChat but safe outside the provider (returns zeros), for components that may render on public pages. */
export function useChatOptional() { return useContext(ChatCtx); }

/**
 * Owns the ONE Server-Sent-Events connection per browser tab.
 *  - reconnects with exponential back-off (also after the server closes the stream or returns an error status),
 *  - asks every subscriber to catch up (`onResync`) after any reconnect, so no message is ever missed,
 *  - keeps live unread counts for the nav badges and the inbox.
 */
export function ChatProvider({ userId, initialUnread, children }: { userId: string; initialUnread: { roomId: string; unread: number; muted: boolean }[]; children: ReactNode }) {
  const [unread, setUnread] = useState<Unread>(() => Object.fromEntries(initialUnread.map((r) => [r.roomId, { n: r.unread, muted: r.muted }])));
  const [live, setLive] = useState<LiveState>("connecting");
  const handlers = useRef(new Set<Handlers>());
  const active = useRef<string | null>(null);
  const readAt = useRef<Record<string, number>>({});          // when each room was last marked read here

  const refreshUnread = useCallback(async () => {
    try {
      const r = await fetch("/api/chat/unread", { cache: "no-store" });
      if (!r.ok) return;
      const j = await r.json();
      // A refresh can race with "mark read": a response computed just before the read was recorded must not bring the badge back.
      const now = Date.now();
      setUnread(Object.fromEntries((j.rooms as { roomId: string; unread: number; muted: boolean }[]).map((x) => [x.roomId, { n: now - (readAt.current[x.roomId] ?? 0) < 5000 ? 0 : x.unread, muted: x.muted }])));
    } catch { /* offline: keep what we have */ }
  }, []);

  useEffect(() => {
    let es: EventSource | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let backoff = 1000;
    let stopped = false;

    const resync = () => { void refreshUnread(); handlers.current.forEach((h) => h.onResync?.()); };

    const connect = () => {
      if (stopped) return;
      setLive("connecting");
      es = new EventSource("/api/chat/stream");
      // Catch up on EVERY (re)connect, including the first: anything sent between the page render and the stream becoming ready
      // (a few hundred ms on a normal connection, more on a slow one) would otherwise be missed until the next event.
      es.addEventListener("ready", () => { setLive("live"); backoff = 1000; resync(); });
      es.addEventListener("room", (ev) => {
        const e = JSON.parse((ev as MessageEvent).data) as RoomEvent;
        if (e.t === "msg" && e.sender !== userId) {
          const looking = active.current === e.room && document.visibilityState === "visible" && document.hasFocus();
          if (!looking) setUnread((u) => ({ ...u, [e.room]: { n: Math.min((u[e.room]?.n ?? 0) + 1, 100), muted: u[e.room]?.muted ?? false } }));
        }
        handlers.current.forEach((h) => h.onRoom?.(e));
      });
      es.addEventListener("typing", (ev) => { const e = JSON.parse((ev as MessageEvent).data) as TypingEvent; handlers.current.forEach((h) => h.onTyping?.(e)); });
      es.addEventListener("resync", resync);
      es.addEventListener("rooms", () => void refreshUnread());
      es.addEventListener("bye", (ev) => {
        const reason = (JSON.parse((ev as MessageEvent).data) as { reason?: string }).reason;
        es?.close(); es = null;
        if (reason === "signed_out") { stopped = true; setLive("offline"); return; }
        timer = setTimeout(connect, 500 + Math.random() * 1500);        // recycle / shutdown: come back shortly
      });
      es.onerror = () => {
        setLive("offline");
        // EventSource retries by itself on network errors, but gives up (CLOSED) on an HTTP error status: reconnect manually then.
        if (es && es.readyState === EventSource.CLOSED) {
          es = null;
          timer = setTimeout(connect, backoff + Math.random() * 500);
          backoff = Math.min(backoff * 2, 30_000);
        }
      };
    };
    connect();

    const onVisible = () => { if (document.visibilityState === "visible") resync(); };       // a hidden tab may have been throttled/suspended
    const onOnline = () => { if (!es || es.readyState === EventSource.CLOSED) { if (timer) clearTimeout(timer); backoff = 1000; connect(); } resync(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    return () => { stopped = true; if (timer) clearTimeout(timer); es?.close(); document.removeEventListener("visibilitychange", onVisible); window.removeEventListener("online", onOnline); };
  }, [userId, refreshUnread]);

  const subscribe = useCallback((h: Handlers) => { handlers.current.add(h); return () => { handlers.current.delete(h); }; }, []);
  const setActiveRoom = useCallback((id: string | null) => { active.current = id; }, []);
  const markRead = useCallback((roomId: string, seq: number) => {
    readAt.current[roomId] = Date.now();
    setUnread((u) => (u[roomId]?.n ? { ...u, [roomId]: { ...u[roomId], n: 0 } } : u));
    void fetch(`/api/chat/rooms/${roomId}/read`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ seq }) }).catch(() => {});
  }, []);
  const setMuted = useCallback((roomId: string, muted: boolean) => setUnread((u) => ({ ...u, [roomId]: { n: u[roomId]?.n ?? 0, muted } })), []);

  const totalUnread = useMemo(() => Object.values(unread).reduce((s, r) => s + (r.muted ? 0 : r.n), 0), [unread]);
  const value = useMemo<Ctx>(() => ({ unread, totalUnread, live, userId, subscribe, setActiveRoom, markRead, setMuted }), [unread, totalUnread, live, userId, subscribe, setActiveRoom, markRead, setMuted]);
  return <ChatCtx.Provider value={value}>{children}</ChatCtx.Provider>;
}
