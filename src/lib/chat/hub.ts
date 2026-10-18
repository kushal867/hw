import "server-only";
import { Client, type Notification } from "pg";
import { logger } from "@/lib/log";
import type { StreamEvent } from "@/lib/chat/types";

/**
 * Real-time fan-out. ONE dedicated Postgres connection LISTENs on channel "chat"; database triggers NOTIFY on every message change.
 * Each connected browser (Server-Sent Events) is registered with the set of rooms it may see, and receives only events for those rooms.
 * Events contain ids only — message text never travels this way, so a stale subscription can't leak content.
 * Works across multiple app instances (every instance LISTENs to the same database) and recovers from DB restarts automatically.
 */
export type Subscriber = {
  userId: string;
  rooms: Set<string>;
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

  private onNotify(m: Notification) {
    if (m.channel !== "chat" || !m.payload) return;
    let e: StreamEvent;
    try { e = JSON.parse(m.payload); } catch { return; }
    if (!e || typeof e.room !== "string") return;
    for (const s of this.subs) {
      if (!s.rooms.has(e.room)) continue;
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
