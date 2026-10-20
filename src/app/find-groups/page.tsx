import Link from "next/link";
import { Globe, Plus, Search, Users } from "lucide-react";
import { GroupAvatar, groupGradient } from "@/components/group-avatar";
import { GroupCard } from "@/components/public/cards";
import { pageMeta } from "@/lib/seo";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { EmptyState, ErrorState, NotConfigured, Pagination } from "@/components/ui/misc";
import { createClient } from "@/lib/server-db";
import { isConfigured } from "@/lib/env";
import { plural, termName } from "@/lib/format";

export const metadata = pageMeta({ title: "Find study groups by college and semester", description: "Search public student study groups for your college, program and semester in Nepal. Join instantly or send a request, or create your own group.", path: "/find-groups", imageTitle: "Find your study group" });
const PAGE = 12;
const POLICY = { open: ["Open to join", "badge-success"], approval: ["Join by request", "badge"], invite_only: ["Invitation only", "badge-muted"] } as const;

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
    const filtered = !!(sp.q || sp.college || sp.semester);
    body = (<>
      <form role="search" className="card -mt-9 mb-8 grid gap-3 p-3 shadow-pop sm:grid-cols-2 lg:grid-cols-[1fr_220px_160px_auto]">
        <div className="relative"><Search className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-slate-500" aria-hidden /><label htmlFor="q" className="sr-only">Search groups</label><input id="q" name="q" defaultValue={sp.q} placeholder="Search by group name" className="input border-transparent bg-slate-50 pl-10" /></div>
        <div><label htmlFor="college" className="sr-only">College</label><select id="college" name="college" defaultValue={sp.college ?? ""} className="input border-transparent bg-slate-50"><option value="">All colleges</option>{colleges?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        <div><label htmlFor="semester" className="sr-only">Term</label><select id="semester" name="semester" defaultValue={sp.semester ?? ""} className="input border-transparent bg-slate-50"><option value="">Any term</option>{Array.from({ length: 8 }, (_, i) => <option key={i} value={i + 1}>Term {i + 1}</option>)}</select></div>
        <button className="btn-primary h-full sm:col-span-2 lg:col-span-1">Search</button>
      </form>
      {error ? <ErrorState /> : !rows.length ? (
        <EmptyState icon={Users} title={filtered ? "No groups match your search" : "No groups yet"} action={<Link href="/groups/new" className="btn-primary"><Plus className="h-4 w-4" aria-hidden />Create the first one</Link>}>
          {filtered ? "Try a different name, or start a group for your class." : "Be the first to start a group for your class or homework."}</EmptyState>
      ) : (<>
        <p className="mb-4 text-sm text-muted">{plural(rows.length, "group")}{(data?.length ?? 0) > PAGE ? "+" : ""} {filtered ? "found" : "to explore"}</p>
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{rows.map((g) => <li key={g.id}><GroupCard g={g} /></li>)}</ul>
        <Pagination page={page} hasNext={(data?.length ?? 0) > PAGE} base={base} /></>)}
    </>);
  }
  return (<><SiteHeader /><main id="main">
    <section className="bg-hero border-b border-line"><div className="mx-auto max-w-6xl px-4 pb-16 pt-12 sm:pt-16">
      <p className="eyebrow mb-2"><Globe className="mr-1.5 inline h-3.5 w-3.5" aria-hidden />Public groups</p>
      <h1 className="text-3xl font-extrabold sm:text-4xl">Find your study group</h1>
      <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-muted">Classes, homework sharing and study circles started by students. Join one, or create your own in a minute.</p>
      <Link href="/groups/new" className="btn-primary btn-lg mt-6"><Plus className="h-4 w-4" aria-hidden />Create a group</Link>
    </div></section>
    <div className="mx-auto max-w-6xl px-4 pb-14">{body}</div>
  </main><SiteFooter /></>);
}
