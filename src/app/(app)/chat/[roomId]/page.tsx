import { notFound } from "next/navigation";
import { ChatPanel } from "@/components/chat/chat-panel";
import { requireUser } from "@/lib/auth";
import { isUuid } from "@/lib/group";
import { getRoomInfo, listMessages } from "@/lib/chat/queries";

export default async function RoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  if (!isUuid(roomId)) notFound();
  const { profile } = await requireUser();
  const room = await getRoomInfo(profile.id, roomId);
  if (!room) notFound();                                                       // not visible to this user (RLS) looks exactly like not existing
  const initial = await listMessages(profile.id, roomId, { limit: 30 });
  return <ChatPanel key={roomId} room={room} me={{ id: profile.id, name: profile.display_name, avatar: profile.avatar_path }} initial={initial} backHref="/chat" />;
}
