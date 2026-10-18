import Link from "next/link";
import { Building2, MapPin, Search } from "lucide-react";
import { GroupAvatar, groupGradient } from "@/components/group-avatar";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { EmptyState, ErrorState, NotConfigured } from "@/components/ui/misc";
import { createClient } from "@/lib/server-db";
import { isConfigured } from "@/lib/env";
import { plural } from "@/lib/format";

export const metadata = { title: "Colleges" };

export default async function Colleges({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  let content;
  if (!isConfigured()) content = <NotConfigured />;
  else {
    let query = (await createClient()).from("colleges").select("id,name,city,slug,logo_path,courses(count)").order("name");
    if (q) query = query.ilike("name", `%${q.replace(/[%_\\]/g, "\\$&")}%`);
    const { data, error } = await query.limit(100);
    content = error ? <ErrorState /> : !data?.length ? (
      <EmptyState icon={Building2} title={q ? "No colleges match your search" : "No colleges added yet"}>
        {q ? "Try a different name." : "Colleges are added by EduSathi administrators. Check back soon."}</EmptyState>
    ) : (
      <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {data.map((c: any) => (
          <li key={c.id}><Link href={`/colleges/${c.slug}`} className="card card-hover group flex h-full flex-col overflow-hidden">
            {c.logo_path
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={`/media/colleges/${c.logo_path}`} alt="" loading="lazy" className="h-32 w-full object-cover" />
              : <div aria-hidden className="h-20" style={{ background: groupGradient(c.id) }} />}
            <div className="flex flex-1 flex-col px-5 pb-5">
              <GroupAvatar name={c.name} seed={c.id} size={48} className="-mt-6 ring-4 ring-surface" />
              <h2 className="mt-3 text-[17px] font-bold leading-snug group-hover:text-brand-700">{c.name}</h2>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">{c.city && <><MapPin className="h-3.5 w-3.5" aria-hidden />{c.city}</>}</p>
              <p className="mt-auto pt-4 text-xs font-semibold text-slate-600">{plural(c.courses?.[0]?.count ?? 0, "program")}</p>
            </div></Link></li>))}
      </ul>);
  }
  return (<><SiteHeader /><main id="main">
    <section className="bg-hero border-b border-line"><div className="mx-auto max-w-6xl px-4 pb-12 pt-12 sm:pt-16">
      <p className="eyebrow mb-2">Colleges</p><h1 className="text-3xl font-extrabold sm:text-4xl">Find your college</h1>
      <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-muted">Browse programs and terms, then find the study groups your classmates already use.</p>
      <form role="search" className="relative mt-6 max-w-md"><Search className="pointer-events-none absolute left-4 top-3.5 h-4 w-4 text-slate-500" aria-hidden />
        <label htmlFor="q" className="sr-only">Search colleges</label><input id="q" name="q" defaultValue={q} placeholder="Search colleges" className="input rounded-full bg-white pl-11 shadow-card" /></form>
    </div></section>
    <div className="mx-auto max-w-6xl px-4 py-10">{content}</div>
  </main><SiteFooter /></>);
}
