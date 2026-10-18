import { z } from "zod";
import { clientFor } from "@/lib/db";
import { route, unwrap } from "@/lib/api";
import { uuidParam } from "@/lib/chat/route-utils";

export const PUT = route({ body: z.object({ muted: z.boolean() }), limit: { bucket: "chat.mute", max: 30, windowSeconds: 60 } },
  async ({ user, params, body }) => { unwrap(await clientFor(user.id).rpc("chat_set_muted", { p_room: uuidParam(params, "id"), p_muted: body.muted })); return { ok: true }; });
