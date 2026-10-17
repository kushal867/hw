import Link from "next/link";
import { MessageSquarePlus, MessagesSquare, Search } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { EmptyState, ErrorState, Pagination } from "@/components/ui/misc";
import { semesterAccess } from "@/lib/semester";
import { createClient } from "@/lib/server-db";
import { POST_TYPES, formatDate } from "@/lib/format";
import { createPost } from "@/app/actions/community";

export const metadata = { title: "Discussions" };
const PAGE = 15;

export default async function Discussions({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { id } = await params; const sp = await searchParams;
  const a = await semesterAccess(id);
  const page = Math.max(1, Number(sp.page) || 1);
  const supabase = await createClient();
  const { data: subjects } = await supabase.from("subjects").select("id,name").eq("semester_id", id).order("name");
  let q = supabase.from("discussion_posts").select("id,title,post_type,created_at,status,profiles(display_name),subjects(name),discussion_comments(count)").eq("semester_id", id).order("created_at", { ascending: false });
  if (sp.q) q = q.ilike("title", `%${sp.q.replace(/[%_\\]/g, "\\$&")}%`);
  if (sp.type && POST_TYPES[sp.type]) q = q.eq("post_type", sp.type);
  if (sp.subject) q = q.eq("subject_id", sp.subject);
  const { data, error } = await q.range((page - 1) * PAGE, page * PAGE);
  const rows = (data ?? []).slice(0, PAGE) as any[];
  const base = `/semesters/${id}/discussions?` + new URLSearchParams(Object.entries(sp).filter(([k, v]) => v && k !== "page") as [string, string][]).toString();
  return (
    <div className="space-y-6">
      {a.role && (
        <details className="card p-4"><summary className="flex cursor-pointer items-center gap-2 font-semibold"><MessageSquarePlus className="h-4 w-4 text-brand-600" aria-hidden />Start a discussion</summary>
          <ActionForm action={createPost.bind(null, id)} className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2"><label htmlFor="title" className="label">Title</label><input id="title" name="title" required minLength={3} maxLength={140} className="input" /></div>
            <div><label htmlFor="post_type" className="label">Category</label><select id="post_type" name="post_type" className="input">{Object.entries(POST_TYPES).filter(([k]) => k !== "announcement" || a.canModerate).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
            <div><label htmlFor="subject" className="label">Subject (optional)</label><select id="subject" name="subject" className="input"><option value="">General</option>{subjects?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
            <div className="sm:col-span-2"><label htmlFor="body" className="label">Details</label><textarea id="body" name="body" required maxLength={5000} rows={4} className="input" /></div>
            <div className="sm:col-span-2"><SubmitButton>Post</SubmitButton></div>
          </ActionForm></details>)}
      <form role="search" className="grid gap-3 sm:grid-cols-4">
        <div className="relative sm:col-span-2"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted" aria-hidden /><label htmlFor="sq" className="sr-only">Search discussions</label><input id="sq" name="q" defaultValue={sp.q} placeholder="Search discussions" className="input pl-9" /></div>
        <select name="type" aria-label="Category" defaultValue={sp.type ?? ""} className="input"><option value="">All categories</option>{Object.entries(POST_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <select name="subject" aria-label="Subject" defaultValue={sp.subject ?? ""} className="input"><option value="">All subjects</option>{subjects?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        <button className="btn-secondary">Apply</button>
      </form>
      {error ? <ErrorState /> : !rows.length ? <EmptyState icon={MessagesSquare} title="No discussions yet">Ask a question, request a missing PDF, or share a study tip.</EmptyState> : (<>
        <ul className="space-y-3">{rows.map((p) => (
          <li key={p.id}><Link href={`/semesters/${id}/discussions/${p.id}`} className="card block p-4 hover:border-brand-200">
            <div className="flex flex-wrap items-center gap-2"><span className="badge">{POST_TYPES[p.post_type]}</span>{p.subjects?.name && <span className="badge !bg-line !text-muted">{p.subjects.name}</span>}{p.status !== "visible" && <span className="badge !bg-warn/10 !text-warn">Hidden</span>}</div>
            <h3 className="mt-2 font-semibold">{p.title}</h3>
            <p className="mt-1 text-xs text-muted">{p.profiles?.display_name} · {formatDate(p.created_at, true)} · {p.discussion_comments?.[0]?.count ?? 0} replies</p></Link></li>))}</ul>
        <Pagination page={page} hasNext={(data?.length ?? 0) > PAGE} base={base} /></>)}
    </div>);
}
