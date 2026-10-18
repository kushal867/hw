import Link from "next/link";
import { MessageCircle, MessagesSquare, Pin, Search } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { EmptyState, ErrorState, Pagination } from "@/components/ui/misc";
import { groupAccess, loadGroup } from "@/lib/group";
import { createClient } from "@/lib/server-db";
import { POST_TONE, POST_TYPES, plural, timeAgo } from "@/lib/format";
import { createPost } from "@/app/actions/community";

export const metadata = { title: "Discussions" };
const PAGE = 15;

export default async function Discussions({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { id } = await params; const sp = await searchParams;
  const a = await groupAccess(id);
  const page = Math.max(1, Number(sp.page) || 1);
  const supabase = await createClient();
  const group = await loadGroup(id);
  const { data: subjects } = group?.semester_id ? await supabase.from("subjects").select("id,name").eq("semester_id", group.semester_id).order("name") : { data: [] as { id: string; name: string }[] };
  let q = supabase.from("discussion_posts").select("id,title,body,post_type,created_at,status,profiles(display_name,avatar_path),subjects(name),discussion_comments(count)").eq("group_id", id).order("created_at", { ascending: false });
  if (sp.q) q = q.ilike("title", `%${sp.q.replace(/[%_\\]/g, "\\$&")}%`);
  if (sp.type && POST_TYPES[sp.type]) q = q.eq("post_type", sp.type);
  if (sp.subject) q = q.eq("subject_id", sp.subject);
  const { data, error } = await q.range((page - 1) * PAGE, page * PAGE);
  const rows = (data ?? []).slice(0, PAGE) as any[];
  const keep = (extra: Record<string, string>) => `/groups/${id}/discussions?` + new URLSearchParams({ ...Object.fromEntries(Object.entries(sp).filter(([k, v]) => v && k !== "page" && k !== "type") as [string, string][]), ...extra }).toString();
  const base = `/groups/${id}/discussions?` + new URLSearchParams(Object.entries(sp).filter(([k, v]) => v && k !== "page") as [string, string][]).toString();
  const types = [["", "All"], ...Object.entries(POST_TYPES)];
  const me = a.profile;

  return (
    <div className="space-y-5">
      {a.role && (
        <details className="card group">
          <summary className="flex cursor-pointer list-none items-center gap-3 p-4 [&::-webkit-details-marker]:hidden">
            <Avatar name={me.display_name} path={me.avatar_path} size={42} />
            <span className="flex-1 rounded-full bg-slate-100 px-5 py-3 text-sm text-slate-600 transition group-hover:bg-slate-200/70 group-open:hidden">Ask a question or share something with the group…</span>
            <span className="hidden font-bold group-open:block">New discussion</span>
          </summary>
          <ActionForm action={createPost.bind(null, id)} className="grid gap-4 border-t border-line p-5 sm:grid-cols-2">
            <div className="sm:col-span-2"><label htmlFor="title" className="label">Title</label><input id="title" name="title" required minLength={3} maxLength={140} className="input" placeholder="What do you want to ask or share?" /></div>
            <div><label htmlFor="post_type" className="label">Category</label><select id="post_type" name="post_type" className="input">{Object.entries(POST_TYPES).filter(([k]) => k !== "announcement" || a.canModerate).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
            {!!subjects?.length && <div><label htmlFor="subject" className="label">Subject <span className="font-normal text-muted">(optional)</span></label><select id="subject" name="subject" className="input"><option value="">General</option>{subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>}
            <div className="sm:col-span-2"><label htmlFor="body" className="label">Details</label><textarea id="body" name="body" required maxLength={5000} rows={5} className="input" placeholder="Add any details that will help classmates answer." /></div>
            <div className="sm:col-span-2"><SubmitButton className="btn-lg">Post to group</SubmitButton></div>
          </ActionForm>
        </details>)}

      <div className="flex flex-wrap items-center gap-2">
        <nav aria-label="Filter by category" className="-mx-4 flex-1 overflow-x-auto px-4 sm:mx-0 sm:px-0"><ul className="flex w-max gap-2 sm:w-auto sm:flex-wrap">{types.map(([k, label]) => {
          const active = (sp.type ?? "") === k;
          return <li key={k || "all"}><Link href={keep(k ? { type: k } : {})} aria-current={active ? "true" : undefined} className={`inline-flex rounded-full border px-3.5 py-1.5 text-sm font-semibold transition ${active ? "border-brand-600 bg-brand-600 text-white" : "border-line bg-surface text-slate-600 hover:border-brand-200 hover:bg-brand-50"}`}>{label}</Link></li>;
        })}</ul></nav>
        <form role="search" className="relative w-full sm:w-64">
          {sp.type && <input type="hidden" name="type" value={sp.type} />}
          <Search className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" aria-hidden /><label htmlFor="sq" className="sr-only">Search discussions</label>
          <input id="sq" name="q" defaultValue={sp.q} placeholder="Search discussions" className="input rounded-full pl-10" />
        </form>
      </div>

      {error ? <ErrorState /> : !rows.length ? <EmptyState icon={MessagesSquare} title={sp.q || sp.type ? "No discussions match" : "No discussions yet"}>{sp.q || sp.type ? "Try a different search or category." : "Ask a question, request a missing PDF, or share a study tip."}</EmptyState> : (<>
        <ul className="space-y-3">{rows.map((p) => {
          const replies = p.discussion_comments?.[0]?.count ?? 0;
          return (
            <li key={p.id}><Link href={`/groups/${id}/discussions/${p.id}`} className="card card-hover flex gap-3.5 p-4 sm:p-5">
              <Avatar name={p.profiles?.display_name ?? "?"} path={p.profiles?.avatar_path} size={42} />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted"><span className="font-semibold text-slate-700">{p.profiles?.display_name}</span> · {timeAgo(p.created_at)}</p>
                <h3 className="mt-0.5 text-base font-bold leading-snug">{p.title}</h3>
                {p.body && <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-slate-600">{p.body}</p>}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${POST_TONE[p.post_type]}`}>{p.post_type === "announcement" && <Pin className="mr-1 h-3 w-3" aria-hidden />}{POST_TYPES[p.post_type]}</span>
                  {p.subjects?.name && <span className="badge-muted">{p.subjects.name}</span>}
                  {p.status !== "visible" && <span className="badge-warn">Hidden</span>}
                  <span className="ml-auto inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600"><MessageCircle className="h-4 w-4" aria-hidden />{plural(replies, "reply", "replies")}</span>
                </div>
              </div></Link></li>);
        })}</ul>
        <Pagination page={page} hasNext={(data?.length ?? 0) > PAGE} base={base} /></>)}
    </div>);
}
