import Link from "next/link";
import { notFound } from "next/navigation";
import { Globe, Users } from "lucide-react";
import { JsonLd } from "@/components/public/json-ld";
import { GroupAvatar, groupGradient } from "@/components/group-avatar";
import { Breadcrumbs } from "@/components/public/breadcrumbs";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { getCurrentUser } from "@/lib/auth";
import { formatDate, plural, termName } from "@/lib/format";
import { createClient } from "@/lib/server-db";
import { abs, pageMeta } from "@/lib/seo";
import { cache } from "react";

type P = { params: Promise<{ id: string }> };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// group_directory only ever contains PUBLIC, active groups and no content: this page can never reveal a private group.
const load = cache(async (id: string) => {
  if (!UUID.test(id)) return null;
  const { data } = await (await createClient()).from("group_directory").select("*").eq("id", id).maybeSingle();
  return data as any | null;
});
const JOIN = { open: "Anyone can join instantly", approval: "Join requests are approved by the group's moderators", invite_only: "Joined by invitation" } as const;

export async function generateMetadata({ params }: P) {
  const g = await load((await params).id);
  if (!g) return { title: "Group not found", robots: { index: false } };
  const where = g.college_name ? `${g.college_name} · ${g.course_name} · ${termName(g.term_label, g.semester_number)}` : "";
  return pageMeta({ title: `${g.name}${g.college_name ? ` (${g.college_name})` : ""} study group`, description: g.description || `${g.name}: a public EduSathi study group${where ? ` for ${where}` : ""}. Join to share notes and study together.`,
    path: `/g/${g.id}`, imageTitle: g.name, imageSub: where || "Public study group on EduSathi" });
}

export default async function PublicGroup({ params }: P) {
  const g = await load((await params).id);
  if (!g) notFound();
  const me = await getCurrentUser();
  const where = g.college_name ? `${g.college_name} · ${g.course_name} · ${termName(g.term_label, g.semester_number)}` : null;
  return (<><SiteHeader /><main id="main" className="mx-auto max-w-3xl px-4 py-10">
    <JsonLd data={{ "@context": "https://schema.org", "@type": "Organization", name: g.name, description: g.description ?? undefined, url: abs(`/g/${g.id}`), memberOf: g.college_name ? { "@type": "CollegeOrUniversity", name: g.college_name } : undefined }} />
    <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Find groups", href: "/find-groups" }, { name: g.name, href: `/g/${g.id}` }]} />
    <div className="card overflow-hidden">
      <div aria-hidden className="h-24" style={{ background: groupGradient(g.id) }} />
      <div className="px-6 pb-8 sm:px-8">
        <GroupAvatar name={g.name} seed={g.id} size={84} className="-mt-11 ring-4 ring-surface" />
        <p className="mt-3"><span className="badge"><Globe className="h-3 w-3" aria-hidden />Public group</span></p>
        <h1 className="mt-2 text-3xl font-extrabold leading-tight">{g.name}</h1>
        {where && <p className="mt-1 text-sm text-muted">{where}</p>}
        {g.description && <p className="mt-4 whitespace-pre-line leading-relaxed text-slate-700">{g.description}</p>}
        <p className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-muted"><span className="flex items-center gap-1.5"><Users className="h-4 w-4" aria-hidden />{plural(Number(g.member_count), "member")}</span>
          <span>{JOIN[g.join_policy as keyof typeof JOIN]}</span><span>Created {formatDate(g.created_at)}</span></p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link href={`/groups/${g.id}`} className="btn-primary btn-lg">{me ? "Open the group" : "Log in to join"}</Link>
          {!me && <Link href="/signup" className="btn-secondary btn-lg">Create a free account</Link>}
        </div>
        <p className="mt-5 text-xs text-muted">Files, discussions and chat are visible to members only.</p>
      </div>
    </div>
    {g.college_slug && <p className="mt-6 text-sm text-muted">More groups for <Link className="font-semibold text-brand-700 underline" href={`/colleges/${g.college_slug}`}>{g.college_name}</Link> · <Link className="font-semibold text-brand-700 underline" href={`/find-groups?college=${g.college_id}`}>all its groups</Link></p>}
  </main><SiteFooter /></>);
}
