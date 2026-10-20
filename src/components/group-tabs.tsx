"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookMarked, CalendarDays, FileText, LayoutGrid, Library, MessageCircle, MessagesSquare, Settings2, Users } from "lucide-react";
import { useChatOptional } from "@/components/chat/chat-provider";

export type TabCounts = { files: number; discussions: number; questions: number; members: number; events?: number };

export function GroupTabs({ id, canModerate, hasSubjects, counts, chatRoomId }: { id: string; canModerate: boolean; hasSubjects: boolean; counts: TabCounts; chatRoomId: string | null }) {
  const path = usePathname();
  const chat = useChatOptional();
  const chatUnread = chatRoomId ? chat?.unread[chatRoomId]?.n ?? 0 : 0;
  const tabs = [
    { s: "", label: "Overview", icon: LayoutGrid },
    ...(hasSubjects ? [{ s: "/subjects", label: "Subjects", icon: Library }] : []),
    { s: "/files", label: "PDFs", icon: FileText, n: counts.files },
    ...(chatRoomId ? [{ s: "/chat", label: "Chat", icon: MessageCircle, n: undefined as number | undefined, alert: chatUnread }] : []),
    { s: "/discussions", label: "Discussions", icon: MessagesSquare, n: counts.discussions },
    { s: "/questions", label: "Questions", icon: BookMarked, n: counts.questions },
    { s: "/events", label: "Events", icon: CalendarDays, n: counts.events },
    { s: "/members", label: "Members", icon: Users, n: counts.members },
    ...(canModerate ? [{ s: "/settings", label: "Manage", icon: Settings2 }] : []),
  ];
  return (
    <nav aria-label="Group sections" className="-mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
      <ul className="flex w-max gap-1 rounded-2xl border border-line bg-surface p-1.5 shadow-card sm:w-full">
        {tabs.map(({ s, label, icon: Icon, n, ...rest }) => {
          const alert = (rest as { alert?: number }).alert ?? 0;
          const href = `/groups/${id}${s}`; const active = s === "" ? path === href : path.startsWith(href);
          return (
            <li key={s} className="sm:flex-1">
              <Link href={href} aria-current={active ? "page" : undefined}
                className={`flex items-center justify-center gap-2 whitespace-nowrap rounded-xl px-3.5 py-2.5 text-sm font-semibold transition ${active ? "bg-brand-600 text-white shadow-sm shadow-brand-600/30" : "text-slate-600 hover:bg-slate-100 hover:text-ink"}`}>
                <Icon className="h-4 w-4" aria-hidden />{label}
                {alert > 0 && <span className={`rounded-full px-1.5 text-[11px] font-bold leading-5 ${active ? "bg-white text-brand-700" : "bg-brand-600 text-white"}`} aria-label={`${alert} unread`}>{alert > 99 ? "99+" : alert}</span>}
                {typeof n === "number" && <span className={`rounded-full px-1.5 text-[11px] font-bold leading-5 ${active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"}`}>{n}</span>}
              </Link>
            </li>);
        })}
      </ul>
    </nav>
  );
}
