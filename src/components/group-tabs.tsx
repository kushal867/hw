"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookMarked, FileText, LayoutGrid, Library, MessagesSquare, Settings2, Users } from "lucide-react";

export type TabCounts = { files: number; discussions: number; questions: number; members: number };

export function GroupTabs({ id, canModerate, hasSubjects, counts }: { id: string; canModerate: boolean; hasSubjects: boolean; counts: TabCounts }) {
  const path = usePathname();
  const tabs = [
    { s: "", label: "Overview", icon: LayoutGrid },
    ...(hasSubjects ? [{ s: "/subjects", label: "Subjects", icon: Library }] : []),
    { s: "/files", label: "PDFs", icon: FileText, n: counts.files },
    { s: "/discussions", label: "Discussions", icon: MessagesSquare, n: counts.discussions },
    { s: "/questions", label: "Questions", icon: BookMarked, n: counts.questions },
    { s: "/members", label: "Members", icon: Users, n: counts.members },
    ...(canModerate ? [{ s: "/settings", label: "Manage", icon: Settings2 }] : []),
  ];
  return (
    <nav aria-label="Group sections" className="-mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
      <ul className="flex w-max gap-1 rounded-2xl border border-line bg-surface p-1.5 shadow-card sm:w-full">
        {tabs.map(({ s, label, icon: Icon, n }) => {
          const href = `/groups/${id}${s}`; const active = s === "" ? path === href : path.startsWith(href);
          return (
            <li key={s} className="sm:flex-1">
              <Link href={href} aria-current={active ? "page" : undefined}
                className={`flex items-center justify-center gap-2 whitespace-nowrap rounded-xl px-3.5 py-2.5 text-sm font-semibold transition ${active ? "bg-brand-600 text-white shadow-sm shadow-brand-600/30" : "text-slate-600 hover:bg-slate-100 hover:text-ink"}`}>
                <Icon className="h-4 w-4" aria-hidden />{label}
                {typeof n === "number" && <span className={`rounded-full px-1.5 text-[11px] font-bold leading-5 ${active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"}`}>{n}</span>}
              </Link>
            </li>);
        })}
      </ul>
    </nav>
  );
}
