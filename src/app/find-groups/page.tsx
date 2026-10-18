import Link from "next/link";
import { Search, Users } from "lucide-react";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { EmptyState, ErrorState, NotConfigured, PageHeader, Pagination } from "@/components/ui/misc";
import { createClient } from "@/lib/supabase/server";
import { isConfigured } from "@/lib/env";

export const metadata = { title: "Find groups" };
const PAGE = 12;
const POLICY = { open: "Open to join", approval: "Join by request", invite_only: "Invitation only" } as const;

export default async function FindGroups({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  let body;
  if (!isConfigured()) body = <NotConfigured />;
  else {
    const supabase = await createClient();
    const { data: colleges } = await supabase.from("colleges").select("id,name").order("name");
    // group_directory only ever contains PUBLIC, active groups and exposes no content.
    let q = supabase.from("group_directory").select("*").order("member_count", { ascending: false }).order("created_at", { ascending: false });
    if (sp.q) q = q.ilike("name", `%${sp.q.replace(/[%_\\]/g, "\\$&")}%`);
    if (sp.college) q = q.eq("college_id", sp.college);
    if (sp.semester) q = q.eq("semester_number", Number(sp.semester));
    const { data, error } = await q.range((page - 1) * PAGE, page * PAGE);
    const rows = (data ?? []).slice(0, PAGE) as any[];
    const base = "/find-groups?" + new URLSearchParams(Object.entries(sp).filter(([k, v]) => v && k !== "page") as [string, string][]).toString();
    body = (<>
      <form role="search" className="card mb-6 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative lg:col-span-2"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted" aria-hidden /><label htmlFor="q" className="sr-only">Search groups</label><input id="q" name="q" defaultValue={sp.q} placeholder="Search groups" className="input pl-9" /></div>
        <div><label htmlFor="college" className="sr-only">College</label><select id="college" name="college" defaultValue={sp.college ?? ""} className="input"><option value="">All colleges</option>{colleges?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        <div className="flex gap-2"><label htmlFor="semester" className="sr-only">Semester</label><select id="semester" name="semester" defaultValue={sp.semester ?? ""} className="input"><option value="">Any semester</option>{Array.from({ length: 8 }, (_, i) => <option key={i} value={i + 1}>Semester {i + 1}</option>)}</select><button className="btn-primary">Search</button></div>
      </form>
      {error ? <ErrorState /> : !rows.length ? (
        <EmptyState icon={Users} title="No groups found" action={<Link href="/groups/new" className="btn-primary">Create the first one</Link>}>Try a different search, or start a group for your class.</EmptyState>
      ) : (<>
        <ul className="grid gap-4 md:grid-cols-2">{rows.map((g) => (
          <li key={g.id}><Link href={`/groups/${g.id}`} className="card block h-full p-5 transition hover:border-brand-200 hover:shadow-pop">
            <h2 className="font-semibold">{g.name}</h2>
            {g.college_name && <p className="text-sm text-muted">{g.college_name} · {g.course_name} · Semester {g.semester_number}</p>}
            {g.description && <p className="mt-2 line-clamp-2 text-sm">{g.description}</p>}
            <p className="mt-3 flex items-center gap-3 text-xs text-muted"><span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" aria-hidden />{g.member_count} members</span><span className="badge">{POLICY[g.join_policy as keyof typeof POLICY]}</span></p>
          </Link></li>))}</ul>
        <Pagination page={page} hasNext={(data?.length ?? 0) > PAGE} base={base} /></>)}
    </>);
  }
  return (<><SiteHeader /><main id="main" className="mx-auto max-w-6xl px-4 py-10">
    <PageHeader title="Find groups" sub="Public student groups for classes, homework sharing and study circles."><Link href="/groups/new" className="btn-primary">Create a group</Link></PageHeader>{body}
  </main><SiteFooter /></>);
}
