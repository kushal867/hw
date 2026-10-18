import { z } from "zod";
import { createAdminClient } from "@/lib/db";
import { ApiError, mapDbError, route } from "@/lib/api";
import { audit } from "@/lib/security";
import { uuid } from "@/lib/chat/route-utils";

/** Open (or find) a 1:1 chat. The SQL function enforces: shares a group, not blocked, not restricted, not yourself. */
export const POST = route({ body: z.object({ userId: uuid }), limit: { bucket: "chat.open_dm", max: 20, windowSeconds: 3600 } }, async ({ user, body }) => {
  const r = await createAdminClient().rpc("chat_open_direct", { p_user: user.id, p_other: body.userId });
  if (r.error) throw r.error.code === "22023" ? new ApiError(400, "invalid", "You can't message yourself.") : mapDbError(r.error);
  await audit(user.id, "chat.open_direct", "user", body.userId);
  return { roomId: r.data as unknown as string };
});
