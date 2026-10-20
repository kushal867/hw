import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Clock, Lightbulb } from "lucide-react";
import { AdSlot } from "@/components/ads/ads";
import { JsonLd } from "@/components/public/json-ld";
import { Breadcrumbs } from "@/components/public/breadcrumbs";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { GUIDES, guideBySlug } from "@/content/guides";
import { formatDate, slugify } from "@/lib/format";
import { abs, ogImage, pageMeta } from "@/lib/seo";

type P = { params: Promise<{ slug: string }> };
export const dynamicParams = false;
export const generateStaticParams = () => GUIDES.map((g) => ({ slug: g.slug }));

export async function generateMetadata({ params }: P) {
  const g = guideBySlug((await params).slug);
  if (!g) return { title: "Guide not found", robots: { index: false } };
  return pageMeta({ title: g.title, description: g.description, path: `/guides/${g.slug}`, type: "article", publishedTime: g.published, modifiedTime: g.updated, imageSub: `${g.category} · ${g.readMinutes} min read` });
}

export default async function GuidePage({ params }: P) {
  const g = guideBySlug((await params).slug);
  if (!g) notFound();
  const related = g.related.map((s) => guideBySlug(s)).filter((x): x is NonNullable<typeof x> => !!x);
  return (<><SiteHeader /><main id="main" className="mx-auto max-w-3xl px-4 py-10">
    <JsonLd data={{ "@context": "https://schema.org", "@type": "Article", headline: g.title, description: g.description, datePublished: g.published, dateModified: g.updated,
      image: ogImage(g.title), mainEntityOfPage: abs(`/guides/${g.slug}`), author: { "@type": "Organization", name: "EduSathi", url: abs("/") },
      publisher: { "@type": "Organization", name: "EduSathi", url: abs("/") } }} />
    <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Guides", href: "/guides" }, { name: g.title, href: `/guides/${g.slug}` }]} />
    <article>
      <header>
        <p className="eyebrow mb-2">{g.category}</p>
        <h1 className="text-3xl font-extrabold leading-tight sm:text-4xl">{g.title}</h1>
        <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted"><span className="inline-flex items-center gap-1.5"><Clock className="h-4 w-4" aria-hidden />{g.readMinutes} min read</span><span>Updated {formatDate(g.updated)}</span></p>
        <p className="mt-6 text-lg leading-relaxed text-slate-700">{g.intro}</p>
      </header>
      <nav aria-label="In this guide" className="card my-8 p-5"><p className="mb-2 text-sm font-bold">In this guide</p>
        <ol className="space-y-1.5 text-sm">{g.sections.map((s) => <li key={s.heading}><a href={`#${slugify(s.heading)}`} className="text-brand-700 hover:underline">{s.heading}</a></li>)}</ol></nav>
      {g.sections.map((s, i) => (
        <section key={s.heading} aria-labelledby={slugify(s.heading)} className="mt-9">
          <h2 id={slugify(s.heading)} className="scroll-mt-24 text-2xl font-extrabold">{s.heading}</h2>
          {s.paragraphs?.map((p, k) => <p key={k} className="mt-3 leading-[1.75] text-slate-700">{p}</p>)}
          {s.steps && <ol className="mt-3 list-decimal space-y-2 pl-6 leading-relaxed text-slate-700 marker:font-bold marker:text-brand-600">{s.steps.map((x) => <li key={x}>{x}</li>)}</ol>}
          {s.bullets && <ul className="mt-3 list-disc space-y-2 pl-6 leading-relaxed text-slate-700 marker:text-brand-500">{s.bullets.map((x) => <li key={x}>{x}</li>)}</ul>}
          {i === 1 && <AdSlot />}
        </section>))}
      <aside className="my-10 flex gap-4 rounded-2xl border border-brand-200 bg-brand-50/70 p-5">
        <Lightbulb className="mt-0.5 h-6 w-6 shrink-0 text-brand-600" aria-hidden />
        <div><p className="font-bold text-brand-900">Key takeaway</p><p className="mt-1 leading-relaxed text-slate-700">{g.takeaway}</p></div>
      </aside>
    </article>
    <div className="rounded-3xl bg-gradient-to-br from-brand-600 to-violet-600 p-7 text-white sm:p-9">
      <h2 className="text-xl font-extrabold">Study together on EduSathi</h2>
      <p className="mt-1.5 max-w-lg text-indigo-100">Create a free group for your class, share notes privately and keep deadlines in one place.</p>
      <div className="mt-4 flex flex-wrap gap-3"><Link href="/signup" className="btn bg-white text-brand-700 hover:bg-indigo-50">Join free</Link><Link href="/find-groups" className="btn border border-white/40 bg-white/10 text-white hover:bg-white/20">Find a group</Link></div>
    </div>
    {related.length > 0 && <section className="mt-12" aria-labelledby="more"><h2 id="more" className="text-xl font-extrabold">Keep reading</h2>
      <ul className="mt-4 grid gap-4 sm:grid-cols-2">{related.map((r) => (
        <li key={r.slug}><Link href={`/guides/${r.slug}`} className="card card-hover block h-full p-5"><p className="font-bold leading-snug">{r.title}</p><p className="mt-1 line-clamp-2 text-sm text-muted">{r.description}</p>
          <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-brand-700">Read <ArrowRight className="h-4 w-4" aria-hidden /></span></Link></li>))}</ul></section>}
  </main><SiteFooter /></>);
}
