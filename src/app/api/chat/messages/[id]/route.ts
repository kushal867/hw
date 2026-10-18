import { z } from "zod";
import { clientFor } from "@/lib/db";
import { ApiError, route, unwrap } from "@/lib/api";
import { MESSAGE_SELECT, shapeMessage } from "@/lib/chat/queries";
import { sanitizeBody } from "@/lib/chat/sanitize";
import { uuidParam } from "@/lib/chat/route-utils";

/** Edit own message (24 h window, enforced by a database trigger). */
export const PATCH = route({ body: z.object({ body: z.string().max(6000) }), limit: { bucket: "chat.edit", max: 30, windowSeconds: 60 } }, async ({ user, params, body }) => {
  const s = sanitizeBody(body.body);
  if (!s.ok) throw new ApiError(400, s.reason, s.reason === "empty" ? "A message can't be empty. Delete it instead." : "Messages are limited to 2000 characters.");
  const r = await clientFor(user.id).from("chat_messages").update({ body: s.text }).eq("id", uuidParam(params, "id")).select(MESSAGE_SELECT).maybeSingle();
  const row = unwrap(r);
  if (!row) throw new ApiError(404, "not_found", "Message not found.");
  return { message: shapeMessage(row, user.id) };
});

/** Delete: the author, or a moderator of that group. The text is erased in the database, not just hidden. */
export const DELETE = route({ limit: { bucket: "chat.delete", max: 60, windowSeconds: 60 } }, async ({ user, params }) => {
  const r = await clientFor(user.id).from("chat_messages").update({ deleted_at: new Date().toISOString() }).eq("id", uuidParam(params, "id")).select(MESSAGE_SELECT).maybeSingle();
  const row = unwrap(r);
  if (!row) throw new ApiError(404, "not_found", "Message not found.");
  return { message: shapeMessage(row, user.id) };
});
