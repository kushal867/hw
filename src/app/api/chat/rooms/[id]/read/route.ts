import { z } from "zod";
import { clientFor } from "@/lib/db";
import { route, unwrap } from "@/lib/api";
import { uuidParam } from "@/lib/chat/route-utils";

/** Mark the room read up to `seq` (never moves backwards; the database function checks access). */
export const POST = route({ body: z.object({ seq: z.number().int().min(0) }), limit: { bucket: "chat.read_state", max: 180, windowSeconds: 60 } },
  async ({ user, params, body }) => { unwrap(await clientFor(user.id).rpc("chat_mark_read", { p_room: uuidParam(params, "id"), p_seq: body.seq })); return { ok: true }; });
