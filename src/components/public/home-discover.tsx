import Link from "next/link";
import { ArrowRight, Clock, MapPin } from "lucide-react";
import { GroupAvatar, groupGradient } from "@/components/group-avatar";
import { GroupCard, NoteCard } from "@/components/public/cards";
import { GUIDES } from "@/content/guides";
import { isConfigured } from "@/lib/env";
import { createClient } from "@/lib/server-db";
import { plural } from "@/lib/format";

/** Real, current content for the home page: colleges, active public groups, latest public notes and guides. Sections with nothing to show are skipped. */
export async function HomeDiscover() {
  let colleges: any[] = [], groups: any[] = [], notes: any[] = [];
  if (isConfigured()) {
    const db = await createClient();
    [colleges, groups, notes] = await Promise.all([
      db.from("colleges").select("id,name,city,slug,logo_path,courses(count)").order("name").limit(8).then((r) => r.data ?? []),
      db.from("group_directory").select("*").order("member_count", { ascending: false }).order("created_at", { ascending: false }).limit(3).then((r) => r.data ?? []),
      db.from("public_notes").select("*").order("published_at", { ascending: false }).limit(4).then((r) => r.data ?? []),
    ]);
  }
  const eyebrow = "eyebrow";
  return (
    <>
      {colleges.length > 0 && (
        <section className="border-y border-line bg-surface py-20" aria-labelledby="colleges">
          <div className="mx-auto max-w-6xl px-4">
            <div className="flex flex-wrap items-end justify-between gap-3"><div><p className={eyebrow}>Browse by college</p><h2 id="colleges" className="mt-2 text-3xl font-extrabold sm:text-4xl">Find your college and semester</h2></div>
              <Link href="/colleges" className="inline-flex items-center gap-1.5 text-sm font-bold text-brand-700 hover:underline">All colleges <ArrowRight className="h-4 w-4" aria-hidden /></Link></div>
            <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{colleges.map((c) => (
              <li key={c.id}><Link href={`/colleges/${c.slug}`} className="card card-hover group flex h-full items-center gap-3 p-4">
                {c.logo_path
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={`/media/colleges/${c.logo_path}`} alt="" loading="lazy" width={48} height={48} className="h-12 w-12 shrink-0 rounded-2xl object-cover" />
                  : <GroupAvatar name={c.name} seed={c.id} size={48} />}
                <div className="min-w-0"><p className="line-clamp-2 text-sm font-bold leading-snug group-hover:text-brand-700">{c.name}</p>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-muted">{c.city && <><MapPin className="h-3 w-3" aria-hidden />{c.city} · </>}{plural(c.courses?.[0]?.count ?? 0, "program")}</p></div>
              </Link></li>))}</ul>
          </div>
        </section>)}
      {groups.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-20" aria-labelledby="groups">
          <div className="flex flex-wrap items-end justify-between gap-3"><div><p className={eyebrow}>Study groups</p><h2 id="groups" className="mt-2 text-3xl font-extrabold sm:text-4xl">Join a group that is already studying</h2></div>
            <Link href="/find-groups" className="inline-flex items-center gap-1.5 text-sm font-bold text-brand-700 hover:underline">Find groups <ArrowRight className="h-4 w-4" aria-hidden /></Link></div>
          <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{groups.map((g) => <li key={g.id}><GroupCard g={g} /></li>)}</ul>
        </section>)}
      {notes.length > 0 && (
        <section className="border-y border-line bg-surface py-20" aria-labelledby="notes">
          <div className="mx-auto max-w-6xl px-4">
            <div className="flex flex-wrap items-end justify-between gap-3"><div><p className={eyebrow}>Public notes</p><h2 id="notes" className="mt-2 text-3xl font-extrabold sm:text-4xl">Fresh notes from students</h2></div>
              <Link href="/public-notes" className="inline-flex items-center gap-1.5 text-sm font-bold text-brand-700 hover:underline">All public notes <ArrowRight className="h-4 w-4" aria-hidden /></Link></div>
            <ul className="mt-8 grid gap-4 md:grid-cols-2">{notes.map((n) => <li key={n.id}><NoteCard n={n} /></li>)}</ul>
          </div>
        </section>)}
      <section className="mx-auto max-w-6xl px-4 py-20" aria-labelledby="guides">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><p className={eyebrow}>Study guides</p><h2 id="guides" className="mt-2 text-3xl font-extrabold sm:text-4xl">Study smarter, not longer</h2></div>
          <Link href="/guides" className="inline-flex items-center gap-1.5 text-sm font-bold text-brand-700 hover:underline">All guides <ArrowRight className="h-4 w-4" aria-hidden /></Link></div>
        <ul className="mt-8 grid gap-5 md:grid-cols-3">{GUIDES.slice(0, 3).map((g) => (
          <li key={g.slug}><Link href={`/guides/${g.slug}`} className="card card-hover group flex h-full flex-col p-6">
            <div aria-hidden className="mb-4 h-1.5 w-12 rounded-full" style={{ background: groupGradient(g.slug) }} />
            <h3 className="text-lg font-extrabold leading-snug group-hover:text-brand-700">{g.title}</h3>
            <p className="mt-2 line-clamp-3 flex-1 text-sm leading-relaxed text-muted">{g.description}</p>
            <p className="mt-4 inline-flex items-center gap-1.5 text-xs text-muted"><Clock className="h-3.5 w-3.5" aria-hidden />{g.readMinutes} min read</p>
          </Link></li>))}</ul>
      </section>
    </>
  );
}
