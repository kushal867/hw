import Link from "next/link";
import { Download, Eye, FileText, Flag, Globe, Search, Trash2 } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { UploadForm } from "@/components/upload-form";
import { EmptyState, ErrorState, Pagination } from "@/components/ui/misc";
import { semesterAccess } from "@/lib/semester";
import { createClient } from "@/lib/server-db";
import { env } from "@/lib/env";
import { CATEGORIES, PUBLISHABLE, formatBytes, formatDate } from "@/lib/format";
import { deleteDocument, requestPublication, withdrawPublication } from "@/app/actions/documents";

export const metadata = { title: "Shared PDFs" };
const PAGE = 10;

export default async function Files({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { id } = await params; const sp = await searchParams;
  const a = await semesterAccess(id);
  const page = Math.max(1, Number(sp.page) || 1);
  const supabase = await createClient();
  const { data: subjects } = await supabase.from("subjects").select("id,name").eq("semester_id", id).order("name");
  let q = supabase.from("documents").select("id,title,description,category,size_bytes,created_at,uploaded_by,moderation_status,visibility,tags,subjects(name),profiles(display_name)")
    .eq("semester_id", id).neq("moderation_status", "removed");
  if (sp.q) q = q.ilike("title", `%${sp.q.replace(/[%_\\]/g, "\\$&")}%`);
  if (sp.category && CATEGORIES[sp.category]) q = q.eq("category", sp.category);
  if (sp.subject) q = q.eq("subject_id", sp.subject);
  q = sp.sort === "title" ? q.order("title") : q.order("created_at", { ascending: false });
  const { data: docs, error } = await q.range((page - 1) * PAGE, page * PAGE);
  const rows = (docs ?? []).slice(0, PAGE) as any[];
  const base = `/semesters/${id}/files?` + new URLSearchParams(Object.entries(sp).filter(([k, v]) => v && k !== "page") as [string, string][]).toString();
  return (
    <div className="space-y-6">
      {a.role && <UploadForm semesterId={id} subjects={subjects ?? []} maxMb={env.maxUploadBytes / 1024 / 1024} />}
      <form role="search" className="grid gap-3 sm:grid-cols-4">
        <div className="relative sm:col-span-2"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted" aria-hidden /><label htmlFor="q" className="sr-only">Search PDFs</label><input id="q" name="q" defaultValue={sp.q} placeholder="Search PDFs" className="input pl-9" /></div>
        <select name="category" aria-label="Category" defaultValue={sp.category ?? ""} className="input"><option value="">All categories</option>{Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <select name="subject" aria-label="Subject" defaultValue={sp.subject ?? ""} className="input"><option value="">All subjects</option>{subjects?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        <select name="sort" aria-label="Sort" defaultValue={sp.sort ?? "newest"} className="input"><option value="newest">Newest</option><option value="title">Title</option></select>
        <button className="btn-secondary">Apply</button>
      </form>
      {error ? <ErrorState /> : !rows.length ? <EmptyState icon={FileText} title="No PDFs yet">{a.role ? "Upload the first one above. It stays private to this semester." : "No files to show."}</EmptyState> : (<>
        <ul className="space-y-3">{rows.map((d) => {
          const mine = d.uploaded_by === a.user.id;
          return (
            <li key={d.id} className="card p-4">
              <div className="flex flex-wrap items-start gap-2"><h3 className="font-semibold">{d.title}</h3><span className="badge">{CATEGORIES[d.category]}</span>
                {d.visibility === "public" ? <span className="badge !bg-success/10 !text-success">Public</span> : d.moderation_status === "pending" ? <span className="badge !bg-warn/10 !text-warn">Pending review</span> : d.moderation_status === "rejected" ? <span className="badge !bg-danger/10 !text-danger">Not approved</span> : <span className="badge !bg-line !text-muted">Private</span>}</div>
              {d.description && <p className="mt-1 text-sm text-muted">{d.description}</p>}
              <p className="mt-1 text-xs text-muted">{[d.subjects?.name, d.profiles?.display_name, formatBytes(d.size_bytes), formatDate(d.created_at)].filter(Boolean).join(" · ")}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <a className="btn-secondary !min-h-[36px]" href={`/api/documents/${d.id}/file`} target="_blank" rel="noopener"><Eye className="h-4 w-4" aria-hidden />Preview</a>
                <a className="btn-secondary !min-h-[36px]" href={`/api/documents/${d.id}/file?download=1`}><Download className="h-4 w-4" aria-hidden />Download</a>
                <Link className="btn-ghost !min-h-[36px]" href={`/report-content?type=document&id=${d.id}`}><Flag className="h-4 w-4" aria-hidden />Report</Link>
                {mine && d.visibility === "private" && PUBLISHABLE.has(d.category) && ["private", "rejected"].includes(d.moderation_status) &&
                  <ActionForm action={async () => { "use server"; return requestPublication(d.id); }} confirm="Submit this PDF for public publication? It will only go live if a reviewer approves it. Only share material you have the right to share."><SubmitButton variant="secondary"><Globe className="h-4 w-4" aria-hidden />Publish publicly</SubmitButton></ActionForm>}
                {mine && (d.visibility === "public" || d.moderation_status === "pending") &&
                  <ActionForm action={async () => { "use server"; return withdrawPublication(d.id); }}><SubmitButton variant="secondary">Make private</SubmitButton></ActionForm>}
                {(mine || a.canModerate) && <ActionForm action={async () => { "use server"; return deleteDocument(d.id); }} confirm="Delete this document permanently?"><SubmitButton variant="ghost"><Trash2 className="h-4 w-4" aria-hidden />Delete</SubmitButton></ActionForm>}
              </div>
            </li>);
        })}</ul>
        <Pagination page={page} hasNext={(docs?.length ?? 0) > PAGE} base={base} /></>)}
    </div>
  );
}
