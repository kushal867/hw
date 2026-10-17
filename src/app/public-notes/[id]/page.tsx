import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, Flag } from "lucide-react";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { createClient } from "@/lib/server-db";
import { CATEGORIES, formatBytes, formatDate } from "@/lib/format";

export default async function NotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { data: n } = await (await createClient()).from("public_notes").select("*").eq("id", id).maybeSingle();
  if (!n) notFound();
  return (<><SiteHeader /><main id="main" className="mx-auto max-w-5xl px-4 py-10">
    <span className="badge">{CATEGORIES[n.category]}</span>
    <h1 className="mt-2 text-2xl font-bold">{n.title}</h1>
    <p className="mt-1 text-sm text-muted">{[n.college_name, n.course_name, `Semester ${n.semester_number}`, n.subject_name].filter(Boolean).join(" · ")}</p>
    <p className="mt-1 text-xs text-muted">Shared by {n.uploader_name} · {formatBytes(n.size_bytes)} · {formatDate(n.published_at)}</p>
    {n.description && <p className="mt-4 whitespace-pre-line">{n.description}</p>}
    <div className="mt-5 flex gap-2">
      <a className="btn-primary" href={`/api/public-notes/${n.id}/file?download=1`}><Download className="h-4 w-4" aria-hidden />Download</a>
      <Link className="btn-secondary" href={`/report-content?type=document&id=${n.id}`}><Flag className="h-4 w-4" aria-hidden />Report</Link>
    </div>
    <iframe title={`Preview of ${n.title}`} src={`/api/public-notes/${n.id}/file`} loading="lazy" className="mt-6 h-[75vh] w-full rounded-card border border-line bg-surface" />
  </main><SiteFooter /></>);
}
