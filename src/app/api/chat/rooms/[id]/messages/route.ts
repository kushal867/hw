import { z } from "zod";
import { clientFor } from "@/lib/db";
import { ApiError, route, unwrap } from "@/lib/api";
import { MESSAGE_SELECT, listMessages, shapeMessage } from "@/lib/chat/queries";
import { sanitizeBody } from "@/lib/chat/sanitize";
import { uuid, uuidParam } from "@/lib/chat/route-utils";

const num = z.coerce.number().int().min(0).optional();

/** History / catch-up. `before` pages backwards, `after` returns newer messages, `id` re-fetches one message. Authorised by RLS. */
export const GET = route({ query: z.object({ before: num, after: num, id: uuid.optional(), limit: z.coerce.number().int().min(1).max(100).optional() }),
  limit: { bucket: "chat.read_api", max: 240, windowSeconds: 60 } },
  async ({ user, params, query }) => listMessages(user.id, uuidParam(params, "id"), query));

/** Send a message. Idempotent per clientId, flood-controlled, sanitised; the database enforces membership, blocks and restrictions. */
export const POST = route({
  body: z.object({ body: z.string().max(6000), clientId: uuid, replyTo: uuid.nullish() }),
  limit: [{ bucket: "chat.send_burst", max: 10, windowSeconds: 10 }, { bucket: "chat.send_hour", max: 400, windowSeconds: 3600 }],
}, async ({ user, params, body }) => {
  const roomId = uuidParam(params, "id");
  const s = sanitizeBody(body.body);
  if (!s.ok) throw new ApiError(400, s.reason, s.reason === "empty" ? "Write a message first." : "Messages are limited to 2000 characters.");
  const db = clientFor(user.id);

  // Anti-spam: the same text from the same person in the same room within 15 s is dropped (a retry of the SAME send is fine).
  const dup = await db.from("chat_messages").select("client_id").eq("room_id", roomId).eq("sender_id", user.id).eq("body", s.text)
    .gte("created_at", new Date(Date.now() - 15_000).toISOString()).limit(1);
  if (dup.data?.length && dup.data[0].client_id !== body.clientId) throw new ApiError(429, "duplicate", "You just sent that message.");

  const ins = await db.from("chat_messages").insert({ room_id: roomId, sender_id: user.id, body: s.text, reply_to: body.replyTo ?? null, client_id: body.clientId }).select(MESSAGE_SELECT).single();
  if (ins.error?.code === "23505") {                                    // the client retried a send that had already succeeded
    const again = await db.from("chat_messages").select(MESSAGE_SELECT).eq("room_id", roomId).eq("sender_id", user.id).eq("client_id", body.clientId).maybeSingle();
    if (again.data) return { message: shapeMessage(again.data, user.id) };
  }
  return { message: shapeMessage(unwrap(ins), user.id) };
});
