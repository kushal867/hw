import { z } from "zod";
import { clientFor } from "@/lib/db";
import { ApiError, mapDbError, route } from "@/lib/api";
import { listMessages } from "@/lib/chat/queries";
import { REACTION_KEYS } from "@/lib/chat/types";
import { uuidParam } from "@/lib/chat/route-utils";

/** Add or remove your reaction. Returns the refreshed message so the UI updates immediately. */
export const PUT = route({ body: z.object({ emoji: z.enum(REACTION_KEYS as [string, ...string[]]), on: z.boolean() }), limit: { bucket: "chat.react", max: 90, windowSeconds: 60 } },
  async ({ user, params, body }) => {
    const id = uuidParam(params, "id");
    const db = clientFor(user.id);
    const visible = await db.from("chat_messages").select("id,room_id,deleted_at").eq("id", id).maybeSingle();
    if (!visible.data) throw new ApiError(404, "not_found", "Message not found.");
    if (visible.data.deleted_at) throw new ApiError(400, "invalid", "You can't react to a deleted message.");
    if (body.on) {
      const r = await db.from("chat_reactions").insert({ message_id: id, user_id: user.id, emoji: body.emoji });
      if (r.error && r.error.code !== "23505") throw mapDbError(r.error);       // already reacted = fine
    } else {
      const r = await db.from("chat_reactions").delete().eq("message_id", id).eq("user_id", user.id).eq("emoji", body.emoji);
      if (r.error) throw mapDbError(r.error);
    }
    const { messages } = await listMessages(user.id, visible.data.room_id, { id });
    return { message: messages[0] ?? null };
  });
