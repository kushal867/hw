import { SESSION_COOKIE, isSessionTokenValid } from "@/lib/session";
import { userSql } from "@/lib/db";
import { route } from "@/lib/api";
import { getHub } from "@/lib/chat/hub";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const roomIds = async (userId: string) => (await userSql<{ room_id: string }>(userId, "select room_id from public.chat_unread()")).map((r) => r.room_id);

/**
 * Server-Sent Events stream of "something changed in room X" notifications (ids only; clients then fetch through the authorised API).
 * The stream ends itself when the session is revoked (logout/expiry) and is recycled every 30 minutes.
 */
export const GET = route({ limit: { bucket: "chat.stream", max: 30, windowSeconds: 60 } }, async ({ req, user }) => {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const rooms = new Set(await roomIds(user.id));
  const enc = new TextEncoder();
  let closed = false;
  let cleanup = () => {};

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const write = (s: string) => { if (closed) return; try { controller.enqueue(enc.encode(s)); } catch { cleanup(); } };
      const send = (event: string, data: unknown) => write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      const unsubscribe = getHub().subscribe({ userId: user.id, rooms, send, close: () => cleanup() });
      const heartbeat = setInterval(() => write(": ping\n\n"), 20_000);                       // keeps proxies from closing an idle connection
      const refresh = setInterval(async () => {                                                // pick up rooms joined/left, and honour logout
        try {
          if (!(await isSessionTokenValid(token))) { send("bye", { reason: "signed_out" }); cleanup(); return; }
          const next = await roomIds(user.id);
          const changed = next.length !== rooms.size || next.some((r) => !rooms.has(r));
          if (changed) { rooms.clear(); next.forEach((r) => rooms.add(r)); send("rooms", { count: next.length }); }
        } catch { /* transient DB problem: try again next tick */ }
      }, 60_000);
      const recycle = setTimeout(() => { send("bye", { reason: "refresh" }); cleanup(); }, 30 * 60_000);
      cleanup = () => {
        if (closed) return; closed = true;
        clearInterval(heartbeat); clearInterval(refresh); clearTimeout(recycle); unsubscribe();
        try { controller.close(); } catch { /* already closed */ }
      };
      req.signal.addEventListener("abort", () => cleanup());
      write("retry: 3000\n\n");
      send("ready", { rooms: rooms.size });
    },
    cancel() { cleanup(); },
  });

  return new Response(stream, { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" } });
});
