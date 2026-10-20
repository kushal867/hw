import Link from "next/link";
import { notFound } from "next/navigation";
import { Library, Plus } from "lucide-react";
import { AdSlot } from "@/components/ads/ads";
import { JsonLd } from "@/components/public/json-ld";
import { GroupCard, NoteCard } from "@/components/public/cards";
import { PublicHero, Section } from "@/components/public/hero";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { plural, termName } from "@/lib/format";
import { loadGroupsFor, loadNotesFor, loadTerm, subjectSlug, termHref } from "@/lib/public-data";
import { abs, pageMeta } from "@/lib/seo";

type P = { params: Promise<{ slug: string; course: string; n: string }> };
const num = (s: string) => (/^\d{1,2}$/.test(s) ? Number(s) : -1);

export async function generateMetadata({ params }: P) {
  const { slug, course, n } = await params;
  const t = await loadTerm(slug, course, num(n));
  if (!t) return { title: "Not found", robots: { index: false } };
  const [notes, groups] = await Promise.all([loadNotesFor({ semesterId: t.semester.id }, 1), loadGroupsFor({ semesterId: t.semester.id }, 1)]);
  const name = termName(t.course.term_label, t.semester.number);
  return pageMeta({
    title: `${t.course.name} ${name} at ${t.college.name}: subjects, notes and study groups`,
    description: `${t.course.name} ${name} at ${t.college.name}${t.subjects.length ? `: ${t.subjects.slice(0, 4).map((s) => s.name).join(", ")}${t.subjects.length > 4 ? " and more" : ""}` : ""}. Find shared notes, important questions and study groups.`,
    path: termHref(slug, course, t.semester.number), imageTitle: `${t.course.name} ${name}`, imageSub: t.college.name,
    index: t.subjects.length > 0 || notes.length > 0 || groups.length > 0,   // never index an empty template page
  });
}

export default async function TermPage({ params }: P) {
  const { slug, course, n } = await params;
  const t = await loadTerm(slug, course, num(n));
  if (!t) notFound();
  const { college, course: c, semester, subjects } = t;
  const name = termName(c.term_label, semester.number);
  const [notes, groups] = await Promise.all([loadNotesFor({ semesterId: semester.id }, 200), loadGroupsFor({ semesterId: semester.id }, 9)]);
  const perSubject = new Map<string, number>(); notes.forEach((x) => x.subject_id && perSubject.set(x.subject_id, (perSubject.get(x.subject_id) ?? 0) + 1));
  const crumbs = [{ name: "Home", href: "/" }, { name: "Colleges", href: "/colleges" }, { name: college.name, href: `/colleges/${college.slug}` },
    { name: c.name, href: `/colleges/${college.slug}/${c.slug}` }, { name, href: termHref(college.slug, c.slug, semester.number) }];
  const FAQ: [string, string][] = [
    [`How do I find ${c.name} ${name} notes?`, `Open a subject below to see the notes students have published for it, or search all public notes. Group members also share files privately inside their study groups.`],
    [`How do I join the ${name} group at ${college.name}?`, groups.length ? `Choose one of the groups listed on this page, then join or send a request. Prefer your own? You can create a group for ${c.name} ${name} in a minute.` : `No group has been created for this ${c.term_label === "Year" ? "year" : "semester"} yet. Create one and invite your classmates with a link or QR code.`],
    ["Is it free?", "Yes. EduSathi is free for students."],
  ];
  return (<><SiteHeader /><main id="main">
    <JsonLd data={{ "@context": "https://schema.org", "@type": "CollectionPage", name: `${c.name} ${name} at ${college.name}`, url: abs(termHref(college.slug, c.slug, semester.number)),
      isPartOf: { "@type": "Course", name: `${c.name} at ${college.name}`, url: abs(`/colleges/${college.slug}/${c.slug}`) } }} />
    <PublicHero crumbs={crumbs} eyebrow={`${college.name} · ${c.name}`} title={`${c.name} ${name} study resources`}
      sub={`Subjects, shared notes and student study groups for ${c.name} ${name} at ${college.name}${semester.academicYear ? ` (${semester.academicYear})` : ""}.`}>
      <div className="mt-5 flex flex-wrap gap-3"><Link href="/groups/new" className="btn-primary"><Plus className="h-4 w-4" aria-hidden />Create a group for {name}</Link>
        <Link href="/signup" className="btn-secondary">Join EduSathi free</Link></div>
    </PublicHero>
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Section title={`${name} subjects`}>
        {!subjects.length ? <p className="card p-6 text-sm text-muted">The subject list for this {c.term_label === "Year" ? "year" : "semester"} has not been added yet.</p> : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{subjects.map((s) => (
            <li key={s.id}><Link href={`${termHref(college.slug, c.slug, semester.number)}/${subjectSlug(s.name, s.id)}`} className="card card-hover flex h-full items-start gap-3 p-4">
              <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-indigo-50 text-brand-600"><Library className="h-5 w-5" /></span>
              <div className="min-w-0"><p className="font-bold leading-snug">{s.name}</p>
                <p className="mt-0.5 text-xs text-muted">{s.code ? `${s.code} · ` : ""}{perSubject.get(s.id) ? plural(perSubject.get(s.id)!, "public note") : "Be the first to share notes"}</p></div></Link></li>))}</ul>)}
      </Section>
      <AdSlot />
      <Section title={`Study groups for ${name}`}>
        {groups.length ? <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{groups.map((g) => <li key={g.id}><GroupCard g={g} /></li>)}</ul>
          : <div className="card p-6"><p className="font-bold">No group for {name} yet</p><p className="mt-1 text-sm text-muted">Start one and invite your classmates. It takes a minute.</p>
              <Link href="/groups/new" className="btn-primary mt-4"><Plus className="h-4 w-4" aria-hidden />Create the first group</Link></div>}
      </Section>
      {notes.length > 0 && <Section title={`Public notes for ${name}`} action={<Link href={`/public-notes?college=${college.id}&semester=${semester.number}`} className="text-sm font-bold text-brand-700 hover:underline">Search all</Link>}>
        <ul className="grid gap-4 md:grid-cols-2">{notes.slice(0, 12).map((x) => <li key={x.id}><NoteCard n={x} /></li>)}</ul></Section>}
      <Section title="Common questions"><div className="space-y-3">{FAQ.map(([q, a]) => (
        <details key={q} className="card group p-5"><summary className="cursor-pointer list-none font-bold [&::-webkit-details-marker]:hidden">{q}</summary><p className="mt-2 text-sm leading-relaxed text-muted">{a}</p></details>))}</div></Section>
    </div>
  </main><SiteFooter /></>);
}
