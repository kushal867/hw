import { ChatShell } from "@/components/chat/chat-shell";
import { requireUser } from "@/lib/auth";
import { listInbox } from "@/lib/chat/queries";

export const metadata = { title: "Chats" };

export default async function ChatLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireUser();
  const rooms = await listInbox(profile.id);
  return <ChatShell rooms={rooms}>{children}</ChatShell>;
}
