import Link from "next/link";
import { ArrowRight, Clock } from "lucide-react";
import { JsonLd } from "@/components/public/json-ld";
import { PublicHero } from "@/components/public/hero";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { GUIDES } from "@/content/guides";
import { abs, pageMeta } from "@/lib/seo";

export const metadata = pageMeta({
  title: "Study guides for students",
  description: "Practical, free study guides: exam plans, note-taking, study groups, past papers, active recall and how to share notes responsibly.",
  path: "/guides", imageTitle: "Study guides for students",
});

const TONE: Record<string, string> = { "Study skills": "bg-indigo-50 text-indigo-700", Exams: "bg-rose-50 text-rose-700", "Study groups": "bg-emerald-50 text-emerald-700", "Using EduSathi": "bg-amber-50 text-amber-700" };

export default function Guides() {
  return (<><SiteHeader /><main id="main">
    <JsonLd data={{ "@context": "https://schema.org", "@type": "CollectionPage", name: "EduSathi study guides", url: abs("/guides"),
      mainEntity: { "@type": "ItemList", itemListElement: GUIDES.map((g, i) => ({ "@type": "ListItem", position: i + 1, url: abs(`/guides/${g.slug}`), name: g.title })) } }} />
    <PublicHero crumbs={[{ name: "Home", href: "/" }, { name: "Guides", href: "/guides" }]} eyebrow="Guides" title="Study smarter, not longer"
      sub="Short, practical guides written for students: how to plan revision, take useful notes, run a study group and use past papers well." />
    <div className="mx-auto max-w-6xl px-4 py-10">
      <ul className="grid gap-5 md:grid-cols-2">{GUIDES.map((g) => (
        <li key={g.slug}><Link href={`/guides/${g.slug}`} className="card card-hover group flex h-full flex-col p-6">
          <span className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-bold ${TONE[g.category]}`}>{g.category}</span>
          <h2 className="mt-3 text-xl font-extrabold leading-snug group-hover:text-brand-700">{g.title}</h2>
          <p className="mt-2 flex-1 leading-relaxed text-muted">{g.description}</p>
          <p className="mt-5 flex items-center justify-between text-sm"><span className="inline-flex items-center gap-1.5 text-muted"><Clock className="h-4 w-4" aria-hidden />{g.readMinutes} min read</span>
            <span className="inline-flex items-center gap-1.5 font-bold text-brand-700">Read <ArrowRight className="h-4 w-4" aria-hidden /></span></p>
        </Link></li>))}</ul>
    </div>
  </main><SiteFooter /></>);
}
