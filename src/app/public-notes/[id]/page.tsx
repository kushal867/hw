import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, Eye, Flag } from "lucide-react";
import { AdSlot } from "@/components/ads/ads";
import { JsonLd } from "@/components/public/json-ld";
import { NoteCard } from "@/components/public/cards";
import { Breadcrumbs } from "@/components/public/breadcrumbs";
import { SaveNoteButton } from "@/components/save-note-button";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { getCurrentUser } from "@/lib/auth";
import { CATEGORIES, formatBytes, formatDate, plural, termName } from "@/lib/format";
import { recordNoteHit } from "@/lib/hits";
import { loadNotesFor, subjectSlug, termHref } from "@/lib/public-data";
import { createClient } from "@/lib/server-db";
import { abs, pageMeta } from "@/lib/seo";
import { cache } from "react";

type P = { params: Promise<{ id: string }> };
const load = cache(async (id: string) => {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const { data } = await (await createClient()).from("public_notes").select("*").eq("id", id).maybeSingle();
  return data as any | null;
});
const whereOf = (n: any) => [n.college_name, n.course_name, n.semester_number ? termName(n.term_label, n.semester_number) : null, n.subject_name].filter(Boolean).join(" · ");

export async function generateMetadata({ params }: P) {
  const n = await load((await params).id);
  if (!n) return { title: "Note not found", robots: { index: false } };
  const where = whereOf(n);
  return pageMeta({ title: `${n.title}${n.subject_name ? ` (${n.subject_name})` : ""}`, description: n.description || `${CATEGORIES[n.category] ?? "Study material"}${where ? ` for ${where}` : ""}. Shared by ${n.uploader_name} on EduSathi.`,
    path: `/public-notes/${n.id}`, type: "article", publishedTime: n.published_at, imageTitle: n.title, imageSub: where || "Public notes on EduSathi" });
}

export default async function NotePage({ params }: P) {
  const { id } = await params;
  const n = await load(id);
  if (!n) notFound();
  void recordNoteHit(n.id, "view");
  const me = await getCurrentUser();
  const db = await createClient();
  const [saved, related] = await Promise.all([
    me ? db.from("note_saves").select("document_id").eq("user_id", me.user.id).eq("document_id", n.id).maybeSingle().then((r) => !!r.data) : Promise.resolve(false),
    loadNotesFor(n.subject_id ? { subjectId: n.subject_id } : n.semester_id ? { semesterId: n.semester_id } : { collegeId: n.college_id ?? undefined }, 5).then((rows) => rows.filter((x) => x.id !== n.id).slice(0, 4)),
  ]);
  const crumbs = [{ name: "Home", href: "/" }, { name: "Public notes", href: "/public-notes" },
    ...(n.college_slug && n.course_slug && n.semester_number ? [{ name: `${n.course_name} ${termName(n.term_label, n.semester_number)}`, href: termHref(n.college_slug, n.course_slug, n.semester_number) }] : []),
    { name: n.title, href: `/public-notes/${n.id}` }];
  return (<><SiteHeader /><main id="main" className="mx-auto max-w-5xl px-4 py-10">
    <JsonLd data={{ "@context": "https://schema.org", "@type": "LearningResource", name: n.title, description: n.description ?? undefined, url: abs(`/public-notes/${n.id}`),
      learningResourceType: CATEGORIES[n.category] ?? "Study material", datePublished: n.published_at, isAccessibleForFree: true, inLanguage: "en",
      author: { "@type": "Person", name: n.uploader_name }, publisher: { "@type": "Organization", name: "EduSathi", url: abs("/") },
      ...(n.subject_name ? { about: { "@type": "Thing", name: n.subject_name } } : {}) }} />
    <Breadcrumbs items={crumbs} />
    <span className="badge">{CATEGORIES[n.category]}</span>
    <h1 className="mt-2 text-2xl font-extrabold sm:text-3xl">{n.title}</h1>
    <p className="mt-1 text-sm text-muted">{n.college_slug && n.course_slug && n.semester_number
      ? <><Link className="hover:text-brand-700 hover:underline" href={`/colleges/${n.college_slug}`}>{n.college_name}</Link> · <Link className="hover:text-brand-700 hover:underline" href={`/colleges/${n.college_slug}/${n.course_slug}`}>{n.course_name}</Link> · <Link className="hover:text-brand-700 hover:underline" href={termHref(n.college_slug, n.course_slug, n.semester_number)}>{termName(n.term_label, n.semester_number)}</Link>
          {n.subject_name && n.subject_slug && <> · <Link className="hover:text-brand-700 hover:underline" href={`${termHref(n.college_slug, n.course_slug, n.semester_number)}/${n.subject_slug}`}>{n.subject_name}</Link></>}</>
      : (whereOf(n) || "Shared by a student group")}</p>
    <p className="mt-1 flex flex-wrap items-center gap-x-3 text-xs text-muted"><span>Shared by {n.uploader_name}</span><span>{formatBytes(n.size_bytes)}</span><span>{formatDate(n.published_at)}</span>
      <span className="inline-flex items-center gap-1"><Eye className="h-3.5 w-3.5" aria-hidden />{plural(n.view_count, "view")}</span><span className="inline-flex items-center gap-1"><Download className="h-3.5 w-3.5" aria-hidden />{plural(n.download_count, "download")}</span></p>
    {n.description && <p className="mt-4 whitespace-pre-line leading-relaxed text-slate-700">{n.description}</p>}
    <div className="mt-5 flex flex-wrap gap-2">
      <a className="btn-primary" href={`/api/public-notes/${n.id}/file?download=1`}><Download className="h-4 w-4" aria-hidden />Download</a>
      <SaveNoteButton id={n.id} saved={saved} signedIn={!!me} />
      <Link className="btn-secondary" href={`/report-content?type=document&id=${n.id}`}><Flag className="h-4 w-4" aria-hidden />Report</Link>
    </div>
    <AdSlot />
    <iframe title={`Preview of ${n.title}`} src={`/api/public-notes/${n.id}/file`} loading="lazy" className="mt-6 h-[75vh] w-full rounded-card border border-line bg-surface" />
    {related.length > 0 && <section className="mt-12" aria-labelledby="rel"><h2 id="rel" className="mb-4 text-xl font-extrabold">More {n.subject_name ? `${n.subject_name} ` : ""}notes</h2>
      <ul className="grid gap-4 md:grid-cols-2">{related.map((r) => <li key={r.id}><NoteCard n={r} /></li>)}</ul></section>}
  </main><SiteFooter /></>);
}
