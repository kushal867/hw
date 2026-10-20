"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bookmark, Compass, FileDown, Globe, Home, MessagesSquare, Plus, Shield, Users } from "lucide-react";
import { useChatOptional } from "@/components/chat/chat-provider";
import { GroupAvatar } from "@/components/group-avatar";

export type NavGroup = { id: string; name: string };

const PRIMARY = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/my-groups", label: "My groups", icon: Users },
  { href: "/chat", label: "Chats", icon: MessagesSquare },
  { href: "/find-groups", label: "Find groups", icon: Compass },
  { href: "/public-notes", label: "Public notes", icon: Globe },
  { href: "/saved", label: "Saved notes", icon: Bookmark },
  { href: "/pdf-maker", label: "PDF maker", icon: FileDown },
];

const isActive = (path: string, href: string) => path === href || (href !== "/dashboard" && path.startsWith(href + "/"));

export function SideNav({ groups, isAdmin }: { groups: NavGroup[]; isAdmin: boolean }) {
  const path = usePathname();
  const chat = useChatOptional();
  const chatUnread = chat?.totalUnread ?? 0;
  const link = (active: boolean) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${active ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100 hover:text-ink"}`;
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto">
      <nav aria-label="Primary" className="space-y-0.5">
        {PRIMARY.map(({ href, label, icon: Icon }) => {
          const active = isActive(path, href);
          return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={link(active)}><Icon className="h-[18px] w-[18px]" aria-hidden />{label}
            {href === "/chat" && chatUnread > 0 && <span className="ml-auto grid min-w-[22px] place-items-center rounded-full bg-brand-600 px-1.5 text-[11px] font-bold leading-[22px] text-white" aria-label={`${chatUnread} unread chat messages`}>{chatUnread > 99 ? "99+" : chatUnread}</span>}</Link>;
        })}
        {isAdmin && <Link href="/admin/reports" className={link(path.startsWith("/admin"))}><Shield className="h-[18px] w-[18px]" aria-hidden />Admin</Link>}
      </nav>
      <nav aria-label="Your groups">
        <div className="mb-2 flex items-center justify-between px-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">Your groups</h2>
          <Link href="/groups/new" className="grid h-6 w-6 place-items-center rounded-lg text-slate-500 hover:bg-brand-50 hover:text-brand-700" aria-label="Create a group"><Plus className="h-4 w-4" /></Link>
        </div>
        {groups.length === 0 ? (
          <p className="px-3 text-sm leading-relaxed text-muted">Groups you create or join will appear here.</p>
        ) : (
          <ul className="space-y-0.5">{groups.map((g) => {
            const active = path.startsWith(`/groups/${g.id}`);
            return <li key={g.id}><Link href={`/groups/${g.id}`} aria-current={active ? "page" : undefined} className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition ${active ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100 hover:text-ink"}`}>
              <GroupAvatar name={g.name} seed={g.id} size={28} className="!rounded-lg" /><span className="truncate">{g.name}</span></Link></li>;
          })}</ul>)}
      </nav>
    </div>
  );
}

export function BottomNav() {
  const path = usePathname();
  const chatUnread = useChatOptional()?.totalUnread ?? 0;
  const item = (href: string, label: string, Icon: typeof Home, badge = false) => {
    const active = isActive(path, href) || (href === "/my-groups" && path.startsWith("/groups") && !path.startsWith("/groups/new"));
    return (
      <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`relative flex min-h-[58px] flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${active ? "text-brand-700" : "text-slate-600"}`}>
        <span className={`grid h-7 w-12 place-items-center rounded-full transition ${active ? "bg-brand-50" : ""}`}><Icon className="h-[22px] w-[22px]" aria-hidden /></span>{label}
        {badge && <span className="absolute right-[26%] top-1.5 h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-white" aria-label="unread messages" />}
      </Link>);
  };
  return (
    <nav aria-label="Mobile primary" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
      {item("/dashboard", "Home", Home)}
      {item("/my-groups", "Groups", Users)}
      <Link href="/groups/new" aria-label="Create a group" className="relative flex items-center justify-center">
        <span className="-mt-6 grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-violet-600 text-white shadow-lg shadow-brand-600/40 ring-4 ring-surface transition active:scale-95"><Plus className="h-7 w-7" /></span></Link>
      {item("/find-groups", "Discover", Compass)}
      {item("/chat", "Chats", MessagesSquare, chatUnread > 0)}
    </nav>
  );
}
