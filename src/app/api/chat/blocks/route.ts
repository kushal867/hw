import { z } from "zod";
import { clientFor } from "@/lib/db";
import { ApiError, mapDbError, route } from "@/lib/api";
import { uuid } from "@/lib/chat/route-utils";

/** Block / unblock someone. Blocking stops them (and you) from sending DMs to each other. The list is private to you. */
export const PUT = route({ body: z.object({ userId: uuid, blocked: z.boolean() }), limit: { bucket: "chat.block", max: 30, windowSeconds: 3600 } }, async ({ user, body }) => {
  if (body.userId === user.id) throw new ApiError(400, "invalid", "You can't block yourself.");
  const db = clientFor(user.id);
  if (body.blocked) {
    const r = await db.from("user_blocks").insert({ blocker_id: user.id, blocked_id: body.userId });
    if (r.error && r.error.code !== "23505") throw mapDbError(r.error);
  } else {
    const r = await db.from("user_blocks").delete().eq("blocker_id", user.id).eq("blocked_id", body.userId);
    if (r.error) throw mapDbError(r.error);
  }
  return { ok: true };
});
