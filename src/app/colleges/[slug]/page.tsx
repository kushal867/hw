import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, GraduationCap, MapPin } from "lucide-react";
import { AdSlot } from "@/components/ads/ads";
import { JsonLd } from "@/components/public/json-ld";
import { GroupCard, NoteCard } from "@/components/public/cards";
import { PublicHero, Section } from "@/components/public/hero";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { EmptyState } from "@/components/ui/misc";
import { termName, plural } from "@/lib/format";
import { loadCollege, loadGroupsFor, loadNotesFor } from "@/lib/public-data";
import { abs, pageMeta } from "@/lib/seo";

type P = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: P) {
  const data = await loadCollege((await params).slug);
  if (!data) return { title: "College not found", robots: { index: false } };
  const { college, courses } = data;
  const programs = courses.map((c) => c.name).join(", ");
  return pageMeta({
    title: `${college.name}${college.city ? `, ${college.city}` : ""}: programs, notes and study groups`,
    description: `Study resources for ${college.name}${programs ? ` (${programs})` : ""}: find your program and semester, browse shared notes and join student study groups on EduSathi.`,
    path: `/colleges/${college.slug}`, imageTitle: college.name, imageSub: [college.city, programs].filter(Boolean).join(" · "), index: courses.length > 0,
  });
}

export default async function College({ params }: P) {
  const data = await loadCollege((await params).slug);
  if (!data) notFound();
  const { college, courses } = data;
  const [groups, notes] = await Promise.all([loadGroupsFor({ collegeId: college.id }, 6), loadNotesFor({ collegeId: college.id }, 6)]);
  const crumbs = [{ name: "Home", href: "/" }, { name: "Colleges", href: "/colleges" }, { name: college.name, href: `/colleges/${college.slug}` }];
  return (<><SiteHeader /><main id="main">
    <JsonLd data={{ "@context": "https://schema.org", "@type": "CollegeOrUniversity", name: college.name, url: abs(`/colleges/${college.slug}`),
      ...(college.city ? { address: { "@type": "PostalAddress", addressLocality: college.city, addressCountry: "NP" } } : {}),
      ...(college.logo_path ? { image: abs(`/media/colleges/${college.logo_path}`) } : {}) }} />
    <PublicHero crumbs={crumbs} eyebrow="College" title={college.name}
      sub={`${college.city ? `${college.city}, Nepal. ` : ""}${courses.length ? `${plural(courses.length, "program")} listed: ${courses.map((c) => c.name).join(", ")}. ` : ""}Choose your program and term to find shared notes, subjects and the study groups your classmates use.`}>
      {college.city && <p className="mt-3 inline-flex items-center gap-1.5 text-sm text-muted"><MapPin className="h-4 w-4" aria-hidden />{college.city}</p>}
    </PublicHero>
    <div className="mx-auto max-w-6xl px-4 py-10">
      {college.logo_path && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/media/colleges/${college.logo_path}`} alt={college.name} className="mb-10 h-48 w-full rounded-card object-cover sm:h-64" />)}
      <Section title="Programs">
        {!courses.length ? <EmptyState icon={GraduationCap} title="No programs yet">Programs for this college haven&apos;t been added.</EmptyState> : (
          <ul className="grid gap-5 md:grid-cols-2">{courses.map((c) => (
            <li key={c.id} className="card flex flex-col p-6">
              <div className="flex flex-wrap items-center gap-2"><h3 className="text-lg font-bold"><Link href={`/colleges/${college.slug}/${c.slug}`} className="hover:text-brand-700">{c.name}</Link></h3>{c.degree_level && <span className="badge">{c.degree_level}</span>}</div>
              <p className="mt-1 text-sm text-muted">{c.semesters?.length ? `${plural(c.semesters.length, c.term_label === "Year" ? "year" : "semester")} of study` : "Terms not added yet"}</p>
              <ul className="mt-4 flex flex-wrap gap-2">{[...(c.semesters ?? [])].sort((a: any, b: any) => a.semester_number - b.semester_number).map((s: any) => (
                <li key={s.id}><Link href={`/colleges/${college.slug}/${c.slug}/${s.semester_number}`} className="btn-secondary !min-h-[36px]">{termName(c.term_label, s.semester_number)}</Link></li>))}</ul>
              <Link href={`/colleges/${college.slug}/${c.slug}`} className="mt-5 inline-flex items-center gap-1.5 text-sm font-bold text-brand-700 hover:underline">All about {c.name} here <ArrowRight className="h-4 w-4" aria-hidden /></Link>
            </li>))}</ul>)}
      </Section>
      <AdSlot />
      {groups.length > 0 && <Section title={`Study groups at ${college.name}`} action={<Link href={`/find-groups?college=${college.id}`} className="text-sm font-bold text-brand-700 hover:underline">See all</Link>}>
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{groups.map((g) => <li key={g.id}><GroupCard g={g} /></li>)}</ul></Section>}
      {notes.length > 0 && <Section title="Latest public notes" action={<Link href={`/public-notes?college=${college.id}`} className="text-sm font-bold text-brand-700 hover:underline">See all</Link>}>
        <ul className="grid gap-4 md:grid-cols-2">{notes.map((n) => <li key={n.id}><NoteCard n={n} /></li>)}</ul></Section>}
      <div className="mt-12 rounded-3xl bg-gradient-to-br from-brand-600 to-violet-600 p-8 text-white sm:p-10">
        <h2 className="text-2xl font-extrabold">Studying at {college.name}?</h2>
        <p className="mt-2 max-w-xl text-indigo-100">Create a free group for your class in a minute, or join one that already exists. Share notes, ask questions and keep deadlines in one place.</p>
        <div className="mt-5 flex flex-wrap gap-3"><Link href="/groups/new" className="btn btn-lg bg-white text-brand-700 hover:bg-indigo-50">Create a group</Link><Link href={`/find-groups?college=${college.id}`} className="btn btn-lg border border-white/40 bg-white/10 text-white hover:bg-white/20">Find a group</Link></div>
      </div>
    </div>
  </main><SiteFooter /></>);
}
