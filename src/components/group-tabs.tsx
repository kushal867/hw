"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BookMarked, CalendarDays, FileText, LayoutGrid, Library, MessageCircle, MessagesSquare, Settings2, Users } from "lucide-react";
import { useChatOptional } from "@/components/chat/chat-provider";

export type TabCounts = { files: number; discussions: number; questions: number; members: number; events?: number };

/**
 * Group section tabs. Compact enough to fit on a laptop; on narrower screens the bar scrolls sideways,
 * the active tab is always scrolled into view, and soft fades show that more tabs exist off-screen.
 */
export function GroupTabs({ id, canModerate, hasSubjects, counts, chatRoomId }: { id: string; canModerate: boolean; hasSubjects: boolean; counts: TabCounts; chatRoomId: string | null }) {
  const path = usePathname();
  const chat = useChatOptional();
  const chatUnread = chatRoomId ? chat?.unread[chatRoomId]?.n ?? 0 : 0;
  const tabs = [
    { s: "", label: "Overview", icon: LayoutGrid },
    ...(hasSubjects ? [{ s: "/subjects", label: "Subjects", icon: Library }] : []),
    { s: "/files", label: "PDFs", icon: FileText, n: counts.files },
    ...(chatRoomId ? [{ s: "/chat", label: "Chat", icon: MessageCircle, alert: chatUnread }] : []),
    { s: "/discussions", label: "Discussions", icon: MessagesSquare, n: counts.discussions },
    { s: "/questions", label: "Questions", icon: BookMarked, n: counts.questions },
    { s: "/events", label: "Events", icon: CalendarDays, n: counts.events },
    { s: "/members", label: "Members", icon: Users, n: counts.members },
    ...(canModerate ? [{ s: "/settings", label: "Manage", icon: Settings2 }] : []),
  ] as { s: string; label: string; icon: typeof Users; n?: number; alert?: number }[];

  const scroller = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ left: false, right: false });
  const update = () => { const el = scroller.current; if (el) setEdge({ left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 }); };
  useEffect(() => {
    const el = scroller.current; if (!el) return;
    el.querySelector<HTMLElement>('[aria-current="page"]')?.scrollIntoView({ inline: "nearest", block: "nearest" });
    update();
    const ro = new ResizeObserver(update); ro.observe(el);
    return () => ro.disconnect();
  }, [path]);

  return (
    <nav aria-label="Group sections" className="relative -mx-4 sm:mx-0">
      <div ref={scroller} onScroll={update} className="overflow-x-auto px-4 [scrollbar-width:none] sm:px-0 [&::-webkit-scrollbar]:hidden">
        <ul className="flex w-max min-w-full gap-1 rounded-2xl lg:gap-0.5 border border-line bg-surface p-1.5 shadow-card">
          {tabs.map(({ s, label, icon: Icon, n, alert = 0 }) => {
            const href = `/groups/${id}${s}`; const active = s === "" ? path === href : path.startsWith(href);
            return (
              <li key={s} className="lg:flex-1">
                <Link href={href} aria-current={active ? "page" : undefined}
                  className={`flex items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-semibold transition lg:px-2.5 ${active ? "bg-brand-600 text-white shadow-sm shadow-brand-600/30" : "text-slate-600 hover:bg-slate-100 hover:text-ink"}`}>
                  <Icon className="h-4 w-4 shrink-0" aria-hidden />{label}
                  {alert > 0 && <span className={`rounded-full px-1.5 text-[11px] font-bold leading-5 ${active ? "bg-white text-brand-700" : "bg-brand-600 text-white"}`} aria-label={`${alert} unread`}>{alert > 99 ? "99+" : alert}</span>}
                  {!!n && <span className={`rounded-full px-1.5 text-[11px] font-bold leading-5 ${active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"}`}>{n}</span>}
                </Link>
              </li>);
          })}
        </ul>
      </div>
      {edge.left && <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-10 rounded-l-2xl bg-gradient-to-r from-canvas to-transparent sm:from-surface" />}
      {edge.right && <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-10 rounded-r-2xl bg-gradient-to-l from-canvas to-transparent sm:from-surface" />}
    </nav>
  );
}
