import Link from "next/link";
import { Download, Eye, FileText, Users } from "lucide-react";
import { GroupAvatar, groupGradient } from "@/components/group-avatar";
import { CATEGORIES, formatBytes, formatDate, plural, termName } from "@/lib/format";

/** A public note, as listed on every public page. */
export function NoteCard({ n }: { n: any }) {
  const where = [n.college_name, n.course_name, n.semester_number ? termName(n.term_label, n.semester_number) : null, n.subject_name].filter(Boolean).join(" · ");
  return (
    <Link href={`/public-notes/${n.id}`} className="card card-hover flex h-full gap-4 p-5">
      <span aria-hidden className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-rose-50 text-rose-600"><FileText className="h-6 w-6" /></span>
      <div className="min-w-0 flex-1"><span className="badge">{CATEGORIES[n.category] ?? "Study material"}</span>
        <h3 className="mt-2 text-[15px] font-bold leading-snug">{n.title}</h3>
        <p className="mt-1 line-clamp-2 text-sm text-muted">{where || "Shared by a student group"}</p>
        <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          <span>By {n.uploader_name}</span><span>{formatBytes(n.size_bytes)}</span><span>{formatDate(n.published_at)}</span>
          {n.view_count > 0 && <span className="inline-flex items-center gap-1"><Eye className="h-3.5 w-3.5" aria-hidden />{n.view_count}</span>}
          {n.download_count > 0 && <span className="inline-flex items-center gap-1"><Download className="h-3.5 w-3.5" aria-hidden />{n.download_count}</span>}
        </p></div>
    </Link>
  );
}

const POLICY = { open: ["Open to join", "badge-success"], approval: ["Join by request", "badge"], invite_only: ["Invitation only", "badge-muted"] } as const;

/** A public group in the directory. Links to its public landing page. */
export function GroupCard({ g }: { g: any }) {
  const [label, cls] = POLICY[g.join_policy as keyof typeof POLICY] ?? POLICY.approval;
  return (
    <Link href={`/g/${g.id}`} className="card card-hover group flex h-full flex-col overflow-hidden">
      <div aria-hidden className="h-16" style={{ background: groupGradient(g.id) }} />
      <div className="flex flex-1 flex-col px-5 pb-5">
        <GroupAvatar name={g.name} seed={g.id} size={56} className="-mt-8 ring-4 ring-surface" />
        <h3 className="mt-3 line-clamp-2 text-[17px] font-bold leading-snug group-hover:text-brand-700">{g.name}</h3>
        {g.college_name && <p className="mt-0.5 line-clamp-1 text-xs text-muted">{g.college_name} · {g.course_name} · {termName(g.term_label, g.semester_number)}</p>}
        <p className="mt-2 line-clamp-2 flex-1 text-sm leading-relaxed text-slate-600">{g.description || "No description yet."}</p>
        <div className="mt-4 flex items-center justify-between gap-2 border-t border-line pt-3.5">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-600"><Users className="h-4 w-4" aria-hidden />{plural(Number(g.member_count), "member")}</span>
          <span className={cls}>{label}</span></div>
      </div>
    </Link>
  );
}
