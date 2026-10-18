import { notFound } from "next/navigation";
import { ChatPanel } from "@/components/chat/chat-panel";
import { groupAccess } from "@/lib/group";
import { getRoomInfo, listMessages, roomIdForGroup } from "@/lib/chat/queries";

export const metadata = { title: "Group chat" };

export default async function GroupChat({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await groupAccess(id);                                            // the group layout already blocks non-members; this is the second check
  const roomId = await roomIdForGroup(a.user.id, id);
  if (!roomId) notFound();
  const room = await getRoomInfo(a.user.id, roomId);
  if (!room) notFound();
  const initial = await listMessages(a.user.id, roomId, { limit: 30 });
  return (
    <div className="card h-[72dvh] min-h-[460px] overflow-hidden">
      <ChatPanel key={roomId} embedded room={room} me={{ id: a.user.id, name: a.profile.display_name, avatar: a.profile.avatar_path }} initial={initial} />
    </div>
  );
}
