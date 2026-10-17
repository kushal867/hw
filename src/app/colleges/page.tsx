import Link from "next/link";
import { Building2, Search } from "lucide-react";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { EmptyState, ErrorState, NotConfigured, PageHeader } from "@/components/ui/misc";
import { createClient } from "@/lib/server-db";
import { isConfigured } from "@/lib/env";

export const metadata = { title: "Colleges" };

export default async function Colleges({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  let content;
  if (!isConfigured()) content = <NotConfigured />;
  else {
    let query = (await createClient()).from("colleges").select("id,name,city,slug").order("name");
    if (q) query = query.ilike("name", `%${q.replace(/[%_\\]/g, "\\$&")}%`);
    const { data, error } = await query.limit(100);
    content = error ? <ErrorState /> : !data?.length ? (
      <EmptyState icon={Building2} title={q ? "No colleges match your search" : "No colleges added yet"}>
        {q ? "Try a different name." : "Colleges are added by EduSathi administrators. Check back soon."}</EmptyState>
    ) : (
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data.map((c) => (
          <li key={c.id}><Link href={`/colleges/${c.slug}`} className="card block p-5 transition hover:border-brand-200 hover:shadow-pop">
            <Building2 className="mb-3 h-5 w-5 text-brand-600" aria-hidden /><h2 className="font-semibold">{c.name}</h2>
            {c.city && <p className="text-sm text-muted">{c.city}</p>}</Link></li>))}
      </ul>);
  }
  return (<><SiteHeader /><main id="main" className="mx-auto max-w-6xl px-4 py-10">
    <PageHeader title="Colleges" sub="Find your college, then your course and semester." />
    <form role="search" className="relative mb-6 max-w-md"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted" aria-hidden />
      <label htmlFor="q" className="sr-only">Search colleges</label><input id="q" name="q" defaultValue={q} placeholder="Search colleges" className="input pl-9" /></form>
    {content}
  </main><SiteFooter /></>);
}
