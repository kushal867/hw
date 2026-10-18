import "server-only";
import { Client, type Notification } from "pg";
import { adminSql } from "@/lib/db";
import { logger } from "@/lib/log";
import type { StreamEvent } from "@/lib/chat/types";

/**
 * Real-time fan-out. ONE dedicated Postgres connection LISTENs on channel "chat"; database triggers NOTIFY on every message change.
 * For every event the hub works out WHO may see that room (group members / DM participants, cached a few seconds) and delivers only to them,
 * so a brand-new DM or a newly joined group is live immediately. Events contain ids only — message text never travels this way, so a stale subscription can't leak content.
 * Works across multiple app instances (every instance LISTENs to the same database) and recovers from DB restarts automatically.
 */
export type Subscriber = {
  userId: string;
  send: (event: string, data: unknown) => void;
  close: () => void;
};

const MAX_STREAMS_PER_USER = 5;

class ChatHub {
  private subs = new Set<Subscriber>();
  private client: Client | null = null;
  private timer: NodeJS.Timeout | null = null;
  private backoff = 1000;
  private everConnected = false;
  private roomUsers = new Map<string, { at: number; users: Set<string> }>();
  private inflight = new Map<string, Promise<Set<string>>>();

  constructor() { void this.connect(); }

  private async connect() {
    if (!process.env.DATABASE_URL) return;
    const client = new Client({ connectionString: process.env.DATABASE_URL, application_name: "edusathi-chat-listener", keepAlive: true });
    client.on("notification", (m) => this.onNotify(m));
    client.on("error", (e) => { logger.warn("chat.listener_error", { message: e.message }); this.reconnect(client); });
    client.on("end", () => this.reconnect(client));
    try {
      await client.connect();
      await client.query("LISTEN chat");
      this.client = client; this.backoff = 1000;
      logger.info("chat.listener_ready", { reconnect: this.everConnected });
      if (this.everConnected) this.broadcast("resync", {});            // we may have missed events while disconnected: tell clients to catch up
      this.everConnected = true;
    } catch (e: any) {
      logger.warn("chat.listener_connect_failed", { message: e?.message });
      this.reconnect(client);
    }
  }

  private reconnect(dead: Client) {
    if (this.client && this.client !== dead) return;                   // an old connection reporting late
    dead.removeAllListeners(); dead.on("error", () => {}); dead.end().catch(() => {});
    this.client = null;
    if (this.timer) return;
    this.timer = setTimeout(() => { this.timer = null; void this.connect(); }, this.backoff);
    this.backoff = Math.min(this.backoff * 2, 30_000);
  }

  /** Users allowed to see a room right now. Cached for a few seconds so a burst of messages costs one query, not one per message. */
  private usersFor(room: string): Promise<Set<string>> {
    const hit = this.roomUsers.get(room);
    if (hit && Date.now() - hit.at < 3000) return Promise.resolve(hit.users);
    let p = this.inflight.get(room);
    if (!p) {
      p = adminSql<{ user_id: string }>(
        `select user_id from public.chat_participants where room_id = $1
         union select gm.user_id from public.chat_rooms r join public.group_members gm on gm.group_id = r.group_id and gm.membership_status = 'active' where r.id = $1 and r.kind = 'group'`, [room])
        .then((rows) => {
          const users = new Set(rows.map((r) => r.user_id));
          this.roomUsers.set(room, { at: Date.now(), users });
          if (this.roomUsers.size > 5000) for (const [k, v] of this.roomUsers) if (Date.now() - v.at > 10_000) this.roomUsers.delete(k);
          return users;
        })
        .finally(() => this.inflight.delete(room));
      this.inflight.set(room, p);
    }
    return p;
  }

  private async onNotify(m: Notification) {
    if (m.channel !== "chat" || !m.payload || this.subs.size === 0) return;
    let e: StreamEvent;
    try { e = JSON.parse(m.payload); } catch { return; }
    if (!e || typeof e.room !== "string") return;
    let users: Set<string>;
    try { users = await this.usersFor(e.room); }
    catch (err: any) { logger.warn("chat.recipients_failed", { message: err?.message }); return; }   // fail closed: clients catch up on their next resync
    for (const s of this.subs) {
      if (!users.has(s.userId)) continue;
      if (e.t === "typing" && e.user === s.userId) continue;           // you don't see your own typing
      s.send(e.t === "typing" ? "typing" : "room", e);
    }
  }

  broadcast(event: string, data: unknown) { for (const s of this.subs) s.send(event, data); }

  subscribe(sub: Subscriber) {
    // Cap concurrent streams per user (many tabs / reconnect storms): the oldest is told to go away.
    const mine = [...this.subs].filter((s) => s.userId === sub.userId);
    while (mine.length >= MAX_STREAMS_PER_USER) { const old = mine.shift()!; old.send("bye", { reason: "too_many_streams" }); old.close(); this.subs.delete(old); }
    this.subs.add(sub);
    return () => { this.subs.delete(sub); };
  }

  stats() { return { subscribers: this.subs.size, listening: !!this.client }; }

  /** Graceful shutdown: tell clients to reconnect elsewhere. */
  shutdown() { this.broadcast("bye", { reason: "shutdown" }); this.subs.forEach((s) => s.close()); this.subs.clear(); this.client?.end().catch(() => {}); }
}

declare global { var __esChatHub: ChatHub | undefined; }
export const getHub = () => (globalThis.__esChatHub ??= new ChatHub());
