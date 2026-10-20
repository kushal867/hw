import Link from "next/link";
import { BookOpenCheck, CalendarClock, ClipboardList, GraduationCap } from "lucide-react";
import { EVENT_KINDS, formatDate, whenLabel } from "@/lib/format";

const KIND = {
  exam: { icon: GraduationCap, tile: "bg-rose-50 text-rose-600", pill: "bg-rose-50 text-rose-700" },
  assignment: { icon: ClipboardList, tile: "bg-amber-50 text-amber-600", pill: "bg-amber-50 text-amber-700" },
  class: { icon: BookOpenCheck, tile: "bg-sky-50 text-sky-600", pill: "bg-sky-50 text-sky-700" },
  other: { icon: CalendarClock, tile: "bg-slate-100 text-slate-600", pill: "bg-slate-100 text-slate-700" },
} as const;

/** One calendar entry: type tile, title, date in Nepal time and a "Tomorrow / In 5 days" chip. `href` makes the whole row a link. */
export function EventRow({ e, group, href, past = false, action }: { e: any; group?: string; href?: string; past?: boolean; action?: React.ReactNode }) {
  const k = KIND[e.kind as keyof typeof KIND] ?? KIND.other; const Icon = k.icon;
  const inner = (
    <>
      <span aria-hidden className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${k.tile}`}><Icon className="h-5 w-5" /></span>
      <div className="min-w-0 flex-1">
        <p className={`truncate font-bold ${past ? "text-slate-500" : ""}`}>{e.title}</p>
        <p className="mt-0.5 text-xs text-muted">{[EVENT_KINDS[e.kind], formatDate(e.starts_at, true), group].filter(Boolean).join(" · ")}</p>
        {e.description && <p className="mt-1 line-clamp-2 text-sm text-slate-600">{e.description}</p>}
      </div>
      <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${past ? "bg-slate-100 text-slate-500" : k.pill}`}>{whenLabel(e.starts_at)}</span>
    </>
  );
  return (
    <div className="flex items-start gap-3.5 p-4">
      {href ? <Link href={href} className="flex min-w-0 flex-1 items-start gap-3.5">{inner}</Link> : <div className="flex min-w-0 flex-1 items-start gap-3.5">{inner}</div>}
      {action}
    </div>
  );
}
