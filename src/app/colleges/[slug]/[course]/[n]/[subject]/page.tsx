import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Plus } from "lucide-react";
import { AdSlot } from "@/components/ads/ads";
import { JsonLd } from "@/components/public/json-ld";
import { GroupCard, NoteCard } from "@/components/public/cards";
import { PublicHero, Section } from "@/components/public/hero";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { termName } from "@/lib/format";
import { loadGroupsFor, loadNotesFor, loadSubject, subjectSlug, termHref } from "@/lib/public-data";
import { abs, pageMeta } from "@/lib/seo";

type P = { params: Promise<{ slug: string; course: string; n: string; subject: string }> };
const num = (s: string) => (/^\d{1,2}$/.test(s) ? Number(s) : -1);

export async function generateMetadata({ params }: P) {
  const { slug, course, n, subject } = await params;
  const t = await loadSubject(slug, course, num(n), subject);
  if (!t) return { title: "Not found", robots: { index: false } };
  const notes = await loadNotesFor({ subjectId: t.subject.id }, 1);
  const name = termName(t.course.term_label, t.semester.number);
  return pageMeta({
    title: `${t.subject.name} notes: ${t.course.name} ${name}, ${t.college.name}`,
    description: `${t.subject.name} study material for ${t.course.name} ${name} at ${t.college.name}: shared notes, previous papers and study groups.`,
    path: `${termHref(slug, course, t.semester.number)}/${subject}`, imageTitle: t.subject.name, imageSub: `${t.course.name} ${name} · ${t.college.name}`,
    index: notes.length > 0,   // subject pages are indexed once there is real material on them
  });
}

export default async function SubjectPage({ params }: P) {
  const { slug, course, n, subject } = await params;
  const t = await loadSubject(slug, course, num(n), subject);
  if (!t) notFound();
  const { college, course: c, semester, subject: s, subjects } = t;
  const name = termName(c.term_label, semester.number);
  const base = termHref(college.slug, c.slug, semester.number);
  const [notes, groups] = await Promise.all([loadNotesFor({ subjectId: s.id }, 24), loadGroupsFor({ semesterId: semester.id }, 3)]);
  const crumbs = [{ name: "Home", href: "/" }, { name: "Colleges", href: "/colleges" }, { name: college.name, href: `/colleges/${college.slug}` },
    { name: c.name, href: `/colleges/${college.slug}/${c.slug}` }, { name, href: base }, { name: s.name, href: `${base}/${subjectSlug(s.name, s.id)}` }];
  const others = subjects.filter((x) => x.id !== s.id);
  return (<><SiteHeader /><main id="main">
    <JsonLd data={{ "@context": "https://schema.org", "@type": "CollectionPage", name: `${s.name} notes (${c.name} ${name}, ${college.name})`, url: abs(`${base}/${subjectSlug(s.name, s.id)}`),
      about: { "@type": "Thing", name: s.name } }} />
    <PublicHero crumbs={crumbs} eyebrow={`${c.name} · ${name}${s.code ? ` · ${s.code}` : ""}`} title={`${s.name} notes and study material`}
      sub={`Notes shared by students for ${s.name} in ${c.name} ${name} at ${college.name}. Join a group to discuss it with classmates.`}>
      <div className="mt-5 flex flex-wrap gap-3"><Link href="/groups/new" className="btn-primary"><Plus className="h-4 w-4" aria-hidden />Start a study group</Link><Link href={`/public-notes?college=${college.id}&semester=${semester.number}&subject=${encodeURIComponent(s.name)}`} className="btn-secondary">Search more notes</Link></div>
    </PublicHero>
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Section title="Public notes">
        {notes.length ? <ul className="grid gap-4 md:grid-cols-2">{notes.map((x) => <li key={x.id}><NoteCard n={x} /></li>)}</ul>
          : <div className="card p-6"><p className="font-bold">No public notes for {s.name} yet</p><p className="mt-1 max-w-xl text-sm text-muted">Students share notes privately inside their groups first; the uploader can publish a file after review. Create or join a group for {name} to get started.</p></div>}
      </Section>
      <AdSlot />
      {groups.length > 0 && <Section title={`Study groups for ${name}`}><ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{groups.map((g) => <li key={g.id}><GroupCard g={g} /></li>)}</ul></Section>}
      {others.length > 0 && <Section title={`Other ${name} subjects`}><ul className="flex flex-wrap gap-2">{others.map((x) => (
        <li key={x.id}><Link href={`${base}/${subjectSlug(x.name, x.id)}`} className="btn-secondary !min-h-[38px]">{x.name}</Link></li>))}</ul>
        <Link href={base} className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-brand-700 hover:underline">Back to {c.name} {name} <ArrowRight className="h-4 w-4" aria-hidden /></Link></Section>}
    </div>
  </main><SiteFooter /></>);
}
