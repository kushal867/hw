import Link from "next/link";
import { Building2, FileText, GraduationCap, Library, Search, Users, BookOpen } from "lucide-react";
import { GroupCard, NoteCard } from "@/components/public/cards";
import { PublicHero } from "@/components/public/hero";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { GUIDES } from "@/content/guides";
import { getCurrentUser } from "@/lib/auth";
import { isConfigured } from "@/lib/env";
import { plural, termName } from "@/lib/format";
import { subjectSlug } from "@/lib/public-data";
import { createClient } from "@/lib/server-db";

export const metadata = { title: "Search", description: "Search colleges, programs, subjects, study groups, public notes and guides on EduSathi.", robots: { index: false, follow: true } };

const uniqById = <T extends { id: string }>(rows: T[]) => [...new Map(rows.map((r) => [r.id, r])).values()];

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = ((await searchParams).q ?? "").trim().slice(0, 80);
  const ready = isConfigured() && q.length >= 2;
  let colleges: any[] = [], courses: any[] = [], subjects: any[] = [], groups: any[] = [], notes: any[] = [], mine: any[] = [];
  if (ready) {
    const db = await createClient();
    const like = `%${q.replace(/[%_\\]/g, "\\$&")}%`;
    const me = await getCurrentUser();
    const [c1, c2, s1, g1, g2, n1, n2, m] = await Promise.all([
      db.from("colleges").select("id,name,city,slug").ilike("name", like).order("name").limit(6),
      db.from("courses").select("id,name,slug,degree_level,colleges(name,slug)").ilike("name", like).order("name").limit(6),
      db.from("subjects").select("id,name,code,semesters(semester_number,courses(name,slug,term_label,colleges(name,slug)))").ilike("name", like).order("name").limit(8),
      db.from("group_directory").select("*").ilike("name", like).order("member_count", { ascending: false }).limit(6),
      db.from("group_directory").select("*").ilike("description", like).order("member_count", { ascending: false }).limit(6),
      db.from("public_notes").select("*").ilike("title", like).order("published_at", { ascending: false }).limit(6),
      db.from("public_notes").select("*").ilike("subject_name", like).order("published_at", { ascending: false }).limit(6),
      me ? db.from("group_members").select("groups(id,name,status)").eq("user_id", me.user.id).eq("membership_status", "active") : Promise.resolve({ data: [] as any[] }),
    ]);
    colleges = c1.data ?? []; courses = c2.data ?? []; subjects = s1.data ?? [];
    groups = uniqById([...(g1.data ?? []), ...(g2.data ?? [])]).slice(0, 6);
    notes = uniqById([...(n1.data ?? []), ...(n2.data ?? [])]).slice(0, 6);
    mine = ((m.data ?? []) as any[]).map((x) => x.groups).filter((g) => g && g.status === "active" && g.name.toLowerCase().includes(q.toLowerCase())).slice(0, 6);
  }
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const guides = ready ? GUIDES.filter((g) => words.every((w) => `${g.title} ${g.description} ${g.category}`.toLowerCase().includes(w))).slice(0, 4) : [];
  const total = colleges.length + courses.length + subjects.length + groups.length + notes.length + guides.length + mine.length;
  const H = ({ icon: Icon, children }: { icon: typeof Users; children: React.ReactNode }) => <h2 className="mb-3 flex items-center gap-2 text-lg font-extrabold"><Icon className="h-5 w-5 text-brand-600" aria-hidden />{children}</h2>;
  return (<><SiteHeader /><main id="main">
    <PublicHero crumbs={[{ name: "Home", href: "/" }, { name: "Search", href: "/search" }]} eyebrow="Search" title={q ? `Results for “${q}”` : "Search EduSathi"}
      sub="Find colleges, programs, subjects, public study groups, shared notes and study guides.">
      <form role="search" className="relative mt-5 max-w-xl"><Search className="pointer-events-none absolute left-4 top-3.5 h-4 w-4 text-slate-500" aria-hidden />
        <label htmlFor="sq" className="sr-only">Search</label><input id="sq" name="q" defaultValue={q} autoFocus={!q} placeholder="e.g. BIT, data structures, Patan, exam plan" className="input rounded-full bg-white pl-11 pr-28 shadow-card" />
        <button className="btn-primary absolute right-1.5 top-1.5 !min-h-[36px] rounded-full px-4">Search</button></form>
    </PublicHero>
    <div className="mx-auto max-w-6xl space-y-10 px-4 py-10">
      {q.length === 1 && <p className="card p-6 text-sm text-muted">Type at least two characters.</p>}
      {ready && total === 0 && (
        <div className="card p-8 text-center"><p className="text-lg font-bold">Nothing found for “{q}”</p><p className="mx-auto mt-1 max-w-md text-sm text-muted">Try a shorter word, a course such as BIT or BBS, or a subject name. You can also start a group for your class.</p>
          <div className="mt-5 flex flex-wrap justify-center gap-3"><Link href="/colleges" className="btn-secondary">Browse colleges</Link><Link href="/groups/new" className="btn-primary">Create a group</Link></div></div>)}
      {!q && <div className="grid gap-5 md:grid-cols-3">{[["Browse colleges", "/colleges", Building2], ["Find a group", "/find-groups", Users], ["Public notes", "/public-notes", FileText]].map(([t, h, I]: any) => (
        <Link key={t} href={h} className="card card-hover flex items-center gap-3 p-5 font-bold"><I className="h-5 w-5 text-brand-600" aria-hidden />{t}</Link>))}</div>}
      {mine.length > 0 && <section><H icon={Users}>Your groups</H><ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{mine.map((g) => <li key={g.id}><Link href={`/groups/${g.id}`} className="card card-hover block p-4 font-bold">{g.name}</Link></li>)}</ul></section>}
      {colleges.length > 0 && <section><H icon={Building2}>Colleges</H><ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{colleges.map((c) => <li key={c.id}><Link href={`/colleges/${c.slug}`} className="card card-hover block p-4"><span className="font-bold">{c.name}</span>{c.city && <span className="block text-xs text-muted">{c.city}</span>}</Link></li>)}</ul></section>}
      {courses.length > 0 && <section><H icon={GraduationCap}>Programs</H><ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{courses.map((c) => <li key={c.id}><Link href={`/colleges/${c.colleges?.slug}/${c.slug}`} className="card card-hover block p-4"><span className="font-bold">{c.name}</span><span className="block text-xs text-muted">{c.colleges?.name}{c.degree_level ? ` · ${c.degree_level}` : ""}</span></Link></li>)}</ul></section>}
      {subjects.length > 0 && <section><H icon={Library}>Subjects</H><ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{subjects.filter((s) => s.semesters?.courses?.colleges).map((s) => { const sem = s.semesters; const co = sem.courses; return (
        <li key={s.id}><Link href={`/colleges/${co.colleges.slug}/${co.slug}/${sem.semester_number}/${subjectSlug(s.name, s.id)}`} className="card card-hover block p-4"><span className="font-bold">{s.name}</span>
          <span className="block text-xs text-muted">{co.name} {termName(co.term_label, sem.semester_number)} · {co.colleges.name}</span></Link></li>); })}</ul></section>}
      {groups.length > 0 && <section><H icon={Users}>Public groups</H><ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{groups.map((g) => <li key={g.id}><GroupCard g={g} /></li>)}</ul></section>}
      {notes.length > 0 && <section><H icon={FileText}>Public notes</H><ul className="grid gap-4 md:grid-cols-2">{notes.map((n) => <li key={n.id}><NoteCard n={n} /></li>)}</ul></section>}
      {guides.length > 0 && <section><H icon={BookOpen}>Study guides</H><ul className="grid gap-4 md:grid-cols-2">{guides.map((g) => <li key={g.slug}><Link href={`/guides/${g.slug}`} className="card card-hover block p-5"><p className="font-bold">{g.title}</p><p className="mt-1 line-clamp-2 text-sm text-muted">{g.description}</p></Link></li>)}</ul></section>}
      {ready && total > 0 && <p className="text-xs text-muted">{plural(total, "result")} shown. Only public content is searched; your private group files and chats are never included in public results.</p>}
    </div>
  </main><SiteFooter /></>);
}
