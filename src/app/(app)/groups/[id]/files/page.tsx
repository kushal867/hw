import Link from "next/link";
import { Download, Eye, FileText, Flag, Globe, MoreHorizontal, Plus, Search, Trash2 } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { AutoSubmit } from "@/components/auto-submit";
import { UploadForm } from "@/components/upload-form";
import { EmptyState, ErrorState, Pagination } from "@/components/ui/misc";
import { groupAccess, loadGroup } from "@/lib/group";
import { createClient } from "@/lib/server-db";
import { env } from "@/lib/env";
import { CATEGORIES, PUBLISHABLE, formatBytes, timeAgo } from "@/lib/format";
import { deleteDocument, requestPublication, withdrawPublication } from "@/app/actions/documents";

export const metadata = { title: "Shared PDFs" };
const PAGE = 10;

export default async function Files({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { id } = await params; const sp = await searchParams;
  const a = await groupAccess(id);
  const page = Math.max(1, Number(sp.page) || 1);
  const supabase = await createClient();
  const group = await loadGroup(id);
  const { data: subjects } = group?.semester_id ? await supabase.from("subjects").select("id,name").eq("semester_id", group.semester_id).order("name") : { data: [] as { id: string; name: string }[] };
  let q = supabase.from("documents").select("id,title,description,category,size_bytes,created_at,uploaded_by,moderation_status,visibility,tags,subjects(name),profiles(display_name)")
    .eq("group_id", id).neq("moderation_status", "removed");
  if (sp.q) q = q.ilike("title", `%${sp.q.replace(/[%_\\]/g, "\\$&")}%`);
  if (sp.category && CATEGORIES[sp.category]) q = q.eq("category", sp.category);
  if (sp.subject) q = q.eq("subject_id", sp.subject);
  q = sp.sort === "title" ? q.order("title") : q.order("created_at", { ascending: false });
  const { data: docs, error } = await q.range((page - 1) * PAGE, page * PAGE);
  const rows = (docs ?? []).slice(0, PAGE) as any[];
  const base = `/groups/${id}/files?` + new URLSearchParams(Object.entries(sp).filter(([k, v]) => v && k !== "page") as [string, string][]).toString();
  const hasFilters = !!(sp.q || sp.category || sp.subject);
  const menuItem = "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-100";
  return (
    <div className="space-y-5">
      {a.role && (
        <details className="card group overflow-hidden" open={!rows.length && !hasFilters}>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 [&::-webkit-details-marker]:hidden">
            <span className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-50 text-indigo-600"><Plus className="h-5 w-5 transition group-open:rotate-45" aria-hidden /></span>
              <span><span className="block font-bold">Upload a PDF</span><span className="block text-xs text-muted">Notes, homework, past papers. Private to this group by default.</span></span></span>
          </summary>
          <div className="border-t border-line p-5"><UploadForm groupId={id} subjects={subjects ?? []} maxMb={env.maxUploadBytes / 1024 / 1024} /></div>
        </details>)}

      <form role="search" className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <AutoSubmit />
        <div className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" aria-hidden /><label htmlFor="q" className="sr-only">Search PDFs</label><input id="q" name="q" defaultValue={sp.q} placeholder="Search PDFs by title" className="input pl-10" /></div>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
          <select name="category" aria-label="Category" defaultValue={sp.category ?? ""} className="input !w-auto shrink-0"><option value="">All categories</option>{Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          {!!subjects?.length && <select name="subject" aria-label="Subject" defaultValue={sp.subject ?? ""} className="input !w-auto max-w-[220px] shrink-0"><option value="">All subjects</option>{subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>}
          <select name="sort" aria-label="Sort" defaultValue={sp.sort ?? "newest"} className="input !w-auto shrink-0"><option value="newest">Newest</option><option value="title">Title A–Z</option></select>
          {hasFilters && <Link href={`/groups/${id}/files`} className="btn-ghost shrink-0">Clear</Link>}
        </div>
        <button className="sr-only">Apply filters</button>
      </form>

      {error ? <ErrorState /> : !rows.length ? <EmptyState icon={FileText} title={hasFilters ? "No PDFs match your search" : "No PDFs yet"}>{hasFilters ? "Try a different search or clear the filters." : a.role ? "Upload the first one above. It stays private to this group." : "No files to show."}</EmptyState> : (<>
        <ul className="space-y-3">{rows.map((d) => {
          const mine = d.uploaded_by === a.user.id;
          const canPublish = mine && d.visibility === "private" && PUBLISHABLE.has(d.category) && ["private", "rejected"].includes(d.moderation_status);
          const canUnpublish = mine && (d.visibility === "public" || d.moderation_status === "pending");
          const canDelete = mine || a.canModerate;
          return (
            <li key={d.id} className="card p-4 sm:p-5">
              <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
                <span aria-hidden className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-rose-50 text-rose-600"><FileText className="h-6 w-6" /></span>
                <div className="min-w-0 flex-1 basis-48">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-[15px] font-bold leading-snug">{d.title}</h3>
                    {d.visibility === "public" ? <span className="badge-success">Public</span> : d.moderation_status === "pending" ? <span className="badge-warn">Pending review</span> : d.moderation_status === "rejected" ? <span className="badge-danger">Not approved</span> : null}
                  </div>
                  {d.description && <p className="mt-1 line-clamp-2 text-sm text-muted">{d.description}</p>}
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted">
                    <span className="badge">{CATEGORIES[d.category]}</span>{d.subjects?.name && <span className="badge-muted">{d.subjects.name}</span>}
                    <span>{d.profiles?.display_name}</span><span>{formatBytes(d.size_bytes)}</span><span>{timeAgo(d.created_at)}</span>
                  </div>
                  {!!d.tags?.length && <p className="mt-2 flex flex-wrap gap-1.5">{d.tags.map((t: string) => <span key={t} className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">#{t}</span>)}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-1.5 max-sm:ml-16">
                  <a className="btn-secondary !min-h-[38px]" href={`/api/documents/${d.id}/file`} target="_blank" rel="noopener"><Eye className="h-4 w-4" aria-hidden /><span className="hidden sm:inline">Preview</span><span className="sr-only sm:hidden">Preview</span></a>
                  <a className="btn-ghost !min-h-[38px] !px-2.5" href={`/api/documents/${d.id}/file?download=1`} aria-label="Download" title="Download"><Download className="h-[18px] w-[18px]" aria-hidden /></a>
                  <details className="relative">
                    <summary className="btn-ghost !min-h-[38px] !px-2.5 cursor-pointer list-none [&::-webkit-details-marker]:hidden" aria-label="More actions" title="More actions"><MoreHorizontal className="h-[18px] w-[18px]" aria-hidden /></summary>
                    <div className="absolute right-0 top-full z-30 mt-1 w-56 rounded-2xl border border-line bg-surface p-1.5 shadow-pop">
                      {canPublish && <ActionForm action={async () => { "use server"; return requestPublication(d.id); }} confirm="Submit this PDF for public publication? It will only go live if a reviewer approves it. Only share material you have the right to share."><button className={menuItem}><Globe className="h-4 w-4" aria-hidden />Publish publicly</button></ActionForm>}
                      {canUnpublish && <ActionForm action={async () => { "use server"; return withdrawPublication(d.id); }}><button className={menuItem}><Globe className="h-4 w-4" aria-hidden />Make private again</button></ActionForm>}
                      <Link className={menuItem} href={`/report-content?type=document&id=${d.id}`}><Flag className="h-4 w-4" aria-hidden />Report</Link>
                      {canDelete && <ActionForm action={async () => { "use server"; return deleteDocument(d.id); }} confirm="Delete this document permanently?"><button className={`${menuItem} text-red-600 hover:!bg-red-50`}><Trash2 className="h-4 w-4" aria-hidden />Delete</button></ActionForm>}
                    </div>
                  </details>
                </div>
              </div>
            </li>);
        })}</ul>
        <Pagination page={page} hasNext={(docs?.length ?? 0) > PAGE} base={base} /></>)}
    </div>
  );
}
