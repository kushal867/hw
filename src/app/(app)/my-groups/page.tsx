import Link from "next/link";
import { Globe, Lock, Plus, Search, Users } from "lucide-react";
import { GroupAvatar, groupGradient } from "@/components/group-avatar";
import { JoinByLink } from "@/components/join-by-link";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/server-db";
import { termName } from "@/lib/format";

export const metadata = { title: "My groups" };
const ROLE_TONE: Record<string, string> = { owner: "bg-amber-50 text-amber-700", moderator: "bg-sky-50 text-sky-700", member: "bg-slate-100 text-slate-600" };

export default async function MyGroups() {
  const { profile } = await requireUser();
  const { data: mine } = await (await createClient()).from("group_members")
    .select("role, membership_status, groups(id, name, description, visibility, status, semesters(semester_number, courses(name, term_label, colleges(name))))")
    .eq("user_id", profile.id).neq("membership_status", "removed");
  const rows = ((mine ?? []) as any[]).filter((m) => m.groups && m.groups.status === "active");
  return (
    <>
      <PageHeader title="My groups" sub="Your classes, homework groups and study circles.">
        <Link href="/find-groups" className="btn-secondary"><Search className="h-4 w-4" aria-hidden />Find groups</Link>
        <Link href="/groups/new" className="btn-primary"><Plus className="h-4 w-4" aria-hidden />Create group</Link>
      </PageHeader>
      {!rows.length ? (
        <EmptyState icon={Users} title="You're not in any group yet" action={<div className="flex flex-wrap justify-center gap-2"><Link href="/groups/new" className="btn-primary">Create a group</Link><Link href="/find-groups" className="btn-secondary">Find groups</Link></div>}>
          Create a group for your class or homework, or find one to join.</EmptyState>
      ) : (
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{rows.map((m) => {
          const g = m.groups;
          return (
            <li key={g.id}><Link href={`/groups/${g.id}`} className="card card-hover group flex h-full flex-col overflow-hidden">
              <div aria-hidden className="h-14" style={{ background: groupGradient(g.id) }} />
              <div className="flex flex-1 flex-col px-5 pb-5">
                <div className="-mt-7 flex items-end justify-between"><GroupAvatar name={g.name} seed={g.id} size={52} className="ring-4 ring-surface" />
                  {g.visibility === "public" ? <Globe className="mb-1 h-4 w-4 text-slate-500" aria-label="Public group" /> : <Lock className="mb-1 h-4 w-4 text-slate-500" aria-label="Private group" />}</div>
                <h2 className="mt-3 line-clamp-2 font-bold leading-snug group-hover:text-brand-700">{g.name}</h2>
                {g.semesters && <p className="mt-0.5 line-clamp-1 text-xs text-muted">{g.semesters.courses?.colleges?.name} · {g.semesters.courses?.name} · {termName(g.semesters.courses?.term_label, g.semesters.semester_number)}</p>}
                <div className="mt-auto flex flex-wrap gap-2 pt-4"><span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${ROLE_TONE[m.role]}`}>{m.role}</span>{m.membership_status === "pending" && <span className="badge-warn">Waiting for approval</span>}</div>
              </div></Link></li>);
        })}</ul>)}
      <section className="card mt-8 flex flex-wrap items-center gap-4 p-5 sm:p-6" aria-labelledby="inv">
        <div className="min-w-[220px] flex-1"><h2 id="inv" className="font-bold">Have an invitation?</h2><p className="mt-1 text-sm text-muted">Scan the QR code with your phone camera, or paste the link here.</p></div>
        <div className="w-full sm:w-[420px]"><JoinByLink /></div>
      </section>
    </>
  );
}
