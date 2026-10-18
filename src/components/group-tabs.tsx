"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function GroupTabs({ id, canModerate, hasSubjects }: { id: string; canModerate: boolean; hasSubjects: boolean }) {
  const path = usePathname();
  const tabs = [["", "Overview"], ...(hasSubjects ? [["/subjects", "Subjects"]] : []), ["/files", "Shared PDFs"], ["/discussions", "Discussions"], ["/questions", "Exam Questions"], ["/members", "Members"], ...(canModerate ? [["/settings", "Manage"]] : [])];
  return (
    <nav aria-label="Group sections" className="-mx-4 overflow-x-auto px-4"><ul className="flex gap-1 border-b border-line">
      {tabs.map(([s, l]) => {
        const href = `/groups/${id}${s}`; const active = s === "" ? path === href : path.startsWith(href);
        return <li key={s}><Link href={href} aria-current={active ? "page" : undefined} className={`block whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium ${active ? "border-brand-600 text-brand-700" : "border-transparent text-muted hover:text-ink"}`}>{l}</Link></li>;
      })}
    </ul></nav>
  );
}
