import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { AdSlot } from "@/components/ads/ads";
import { JsonLd } from "@/components/public/json-ld";
import { GroupCard, NoteCard } from "@/components/public/cards";
import { PublicHero, Section } from "@/components/public/hero";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { createClient } from "@/lib/server-db";
import { plural, termName } from "@/lib/format";
import { loadCourse, loadGroupsFor, loadNotesFor } from "@/lib/public-data";
import { abs, pageMeta } from "@/lib/seo";

type P = { params: Promise<{ slug: string; course: string }> };

export async function generateMetadata({ params }: P) {
  const { slug, course } = await params;
  const data = await loadCourse(slug, course);
  if (!data) return { title: "Program not found", robots: { index: false } };
  return pageMeta({
    title: `${data.course.name} at ${data.college.name}: semesters, subjects, notes and groups`,
    description: `Everything for ${data.course.name} students at ${data.college.name}: ${data.course.term_label === "Year" ? "yearly terms" : "semester-by-semester"} subjects, shared notes and study groups on EduSathi.`,
    path: `/colleges/${slug}/${course}`, imageTitle: `${data.course.name} · ${data.college.name}`,
  });
}

export default async function CoursePage({ params }: P) {
  const { slug, course: cslug } = await params;
  const data = await loadCourse(slug, cslug);
  if (!data) notFound();
  const { college, course } = data;
  const db = await createClient();
  const [{ data: terms }, groups, notes] = await Promise.all([
    db.from("semesters").select("id,semester_number,academic_year,subjects(id,name)").eq("course_id", course.id).order("semester_number"),
    loadGroupsFor({ courseId: course.id }, 6), loadNotesFor({ courseId: course.id }, 6),
  ]);
  const label = course.term_label === "Year" ? "year" : "semester";
  const crumbs = [{ name: "Home", href: "/" }, { name: "Colleges", href: "/colleges" }, { name: college.name, href: `/colleges/${college.slug}` }, { name: course.name, href: `/colleges/${college.slug}/${course.slug}` }];
  return (<><SiteHeader /><main id="main">
    <JsonLd data={{ "@context": "https://schema.org", "@type": "Course", name: `${course.name} at ${college.name}`, url: abs(`/colleges/${college.slug}/${course.slug}`),
      description: `${course.name} (${course.degree_level ?? "program"}) offered by ${college.name}.`, provider: { "@type": "CollegeOrUniversity", name: college.name, url: abs(`/colleges/${college.slug}`) } }} />
    <PublicHero crumbs={crumbs} eyebrow={course.degree_level ?? "Program"} title={`${course.name} at ${college.name}`}
      sub={`${terms?.length ? `${plural(terms.length, label)} of study. ` : ""}Pick your ${label} to see its subjects, shared notes and the student groups preparing together.`} />
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Section title={`${course.term_label === "Year" ? "Years" : "Semesters"} and subjects`}>
        <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">{(terms ?? []).map((t: any) => {
          const subs = [...(t.subjects ?? [])].sort((a: any, b: any) => a.name.localeCompare(b.name));
          return (
            <li key={t.id}><Link href={`/colleges/${college.slug}/${course.slug}/${t.semester_number}`} className="card card-hover flex h-full flex-col p-5">
              <p className="text-lg font-extrabold">{termName(course.term_label, t.semester_number)}</p>
              {t.academic_year && <p className="text-xs text-muted">{t.academic_year}</p>}
              <ul className="mt-3 flex-1 space-y-1 text-sm text-slate-600">{subs.slice(0, 4).map((s: any) => <li key={s.id} className="line-clamp-1">• {s.name}</li>)}
                {subs.length > 4 && <li className="text-muted">+ {subs.length - 4} more</li>}
                {!subs.length && <li className="text-muted">Subjects coming soon</li>}</ul>
              <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-brand-700">Open <ArrowRight className="h-4 w-4" aria-hidden /></span>
            </Link></li>);})}</ul>
      </Section>
      <AdSlot />
      {groups.length > 0 && <Section title={`${course.name} study groups`}><ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{groups.map((g) => <li key={g.id}><GroupCard g={g} /></li>)}</ul></Section>}
      {notes.length > 0 && <Section title="Latest public notes"><ul className="grid gap-4 md:grid-cols-2">{notes.map((n) => <li key={n.id}><NoteCard n={n} /></li>)}</ul></Section>}
      <p className="mt-12 text-sm text-muted">Not seeing your class? <Link href="/groups/new" className="font-semibold text-brand-700 underline">Create a group</Link> for your {label} and invite classmates.</p>
    </div>
  </main><SiteFooter /></>);
}
