import { route } from "@/lib/api";
import { unreadFor } from "@/lib/chat/queries";

export const GET = route({ limit: { bucket: "chat.unread", max: 120, windowSeconds: 60 } }, async ({ user }) => ({ rooms: await unreadFor(user.id) }));
