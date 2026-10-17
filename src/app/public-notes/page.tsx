import Link from "next/link";
import { FileText, Search } from "lucide-react";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { EmptyState, ErrorState, NotConfigured, PageHeader, Pagination } from "@/components/ui/misc";
import { createClient } from "@/lib/supabase/server";
import { isConfigured } from "@/lib/env";
import { CATEGORIES, formatBytes, formatDate } from "@/lib/format";

export const metadata = { title: "Public Notes" };
const PAGE = 12;

export default async function PublicNotes({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  let body;
  if (!isConfigured()) body = <NotConfigured />;
  else {
    const supabase = await createClient();
    const [{ data: colleges }] = await Promise.all([supabase.from("colleges").select("id,name").order("name")]);
    // The public_notes view only ever contains approved + public documents.
    let q = supabase.from("public_notes").select("*").order(sp.sort === "relevance" && sp.q ? "title" : "published_at", { ascending: sp.sort === "relevance" && !!sp.q });
    if (sp.q) q = q.ilike("title", `%${sp.q.replace(/[%_\\]/g, "\\$&")}%`);
    if (sp.college) q = q.eq("college_id", sp.college);
    if (sp.category && CATEGORIES[sp.category]) q = q.eq("category", sp.category);
    if (sp.semester) q = q.eq("semester_number", Number(sp.semester));
    if (sp.subject) q = q.ilike("subject_name", `%${sp.subject.replace(/[%_\\]/g, "\\$&")}%`);
    const { data, error } = await q.range((page - 1) * PAGE, page * PAGE); // fetch one extra row to know if there is a next page
    const rows = data?.slice(0, PAGE) ?? [];
    const base = "/public-notes?" + new URLSearchParams(Object.entries(sp).filter(([k, v]) => v && k !== "page") as [string, string][]).toString();
    body = (<>
      <form role="search" className="card mb-6 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-6">
        <div className="relative lg:col-span-2"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted" aria-hidden />
          <label htmlFor="q" className="sr-only">Search by title</label><input id="q" name="q" defaultValue={sp.q} placeholder="Search by title" className="input pl-9" /></div>
        <div><label htmlFor="college" className="sr-only">College</label><select id="college" name="college" defaultValue={sp.college ?? ""} className="input"><option value="">All colleges</option>{colleges?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        <div><label htmlFor="semester" className="sr-only">Semester</label><select id="semester" name="semester" defaultValue={sp.semester ?? ""} className="input"><option value="">All semesters</option>{Array.from({ length: 8 }, (_, i) => <option key={i} value={i + 1}>Semester {i + 1}</option>)}</select></div>
        <div><label htmlFor="category" className="sr-only">Category</label><select id="category" name="category" defaultValue={sp.category ?? ""} className="input"><option value="">All categories</option>{Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
        <div><label htmlFor="sort" className="sr-only">Sort</label><select id="sort" name="sort" defaultValue={sp.sort ?? "newest"} className="input"><option value="newest">Newest</option><option value="relevance">Relevance</option></select></div>
        <input name="subject" defaultValue={sp.subject} placeholder="Subject" aria-label="Subject" className="input lg:col-span-2" />
        <button className="btn-primary lg:col-span-1">Search</button>
      </form>
      {error ? <ErrorState /> : !rows.length ? (
        <EmptyState icon={FileText} title="No public notes found">Public notes appear here after the uploader publishes them and a reviewer approves them.</EmptyState>
      ) : (<>
        <ul className="grid gap-4 md:grid-cols-2">
          {rows.map((n) => (
            <li key={n.id}><Link href={`/public-notes/${n.id}`} className="card block h-full p-5 transition hover:border-brand-200 hover:shadow-pop">
              <span className="badge">{CATEGORIES[n.category]}</span>
              <h2 className="mt-2 font-semibold">{n.title}</h2>
              <p className="mt-1 text-sm text-muted">{[n.college_name, n.course_name, `Semester ${n.semester_number}`, n.subject_name].filter(Boolean).join(" · ")}</p>
              <p className="mt-3 text-xs text-muted">By {n.uploader_name} · {formatBytes(n.size_bytes)} · {formatDate(n.published_at)}</p>
            </Link></li>))}
        </ul>
        <Pagination page={page} hasNext={(data?.length ?? 0) > PAGE} base={base} /></>)}
    </>);
  }
  return (<><SiteHeader /><main id="main" className="mx-auto max-w-6xl px-4 py-10">
    <PageHeader title="Public Notes" sub="Approved study notes shared openly by students." />{body}
  </main><SiteFooter /></>);
}
