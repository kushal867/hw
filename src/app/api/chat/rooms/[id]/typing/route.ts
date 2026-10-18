import { adminSql, clientFor, userSql } from "@/lib/db";
import { ApiError, route } from "@/lib/api";
import { uuidParam } from "@/lib/chat/route-utils";

/** Ephemeral "is typing" signal. Nothing is stored: it is a NOTIFY that the hub forwards to the other members' open streams. */
export const POST = route({ limit: { bucket: "chat.typing", max: 40, windowSeconds: 60 } }, async ({ user, params }) => {
  const room = uuidParam(params, "id");
  const [{ ok } = { ok: false }] = await userSql<{ ok: boolean }>(user.id, "select public.can_send_room($1) as ok", [room]);
  if (!ok) throw new ApiError(403, "forbidden", "You can't send messages here.");
  const { data: me } = await clientFor(user.id).from("profiles").select("display_name").eq("id", user.id).maybeSingle();
  await adminSql("select pg_notify('chat', $1)", [JSON.stringify({ t: "typing", room, user: user.id, name: me?.display_name ?? "Someone" })]);
  return { ok: true };
});
