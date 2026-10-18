import Link from "next/link";
import { Globe, Lock, Plus, Search, Users } from "lucide-react";
import { JoinByLink } from "@/components/join-by-link";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth";
import { termName } from "@/lib/format";
import { createClient } from "@/lib/server-db";

export const metadata = { title: "My Groups" };

export default async function MyGroups() {
  const { profile } = await requireUser();
  const { data: mine } = await (await createClient()).from("group_members")
    .select("role, membership_status, groups(id, name, description, visibility, status, semesters(semester_number, courses(name, term_label, colleges(name))))")
    .eq("user_id", profile.id).neq("membership_status", "removed");
  const rows = ((mine ?? []) as any[]).filter((m) => m.groups && m.groups.status === "active");
  return (
    <>
      <PageHeader title="My Groups" sub="Your classes, homework groups and study circles.">
        <Link href="/find-groups" className="btn-secondary"><Search className="h-4 w-4" aria-hidden />Find groups</Link>
        <Link href="/groups/new" className="btn-primary"><Plus className="h-4 w-4" aria-hidden />Create group</Link>
      </PageHeader>
      <section className="card mb-6 p-5"><h2 className="mb-1 font-semibold">Join with an invitation</h2>
        <p className="mb-3 text-sm text-muted">Scan the QR code with your phone camera, or paste the link here.</p><JoinByLink /></section>
      {!rows.length ? (
        <EmptyState icon={Users} title="You're not in any group yet" action={<div className="flex gap-2"><Link href="/groups/new" className="btn-primary">Create a group</Link><Link href="/find-groups" className="btn-secondary">Find groups</Link></div>}>
          Create a group for your class or homework, or find one to join.</EmptyState>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">{rows.map((m) => (
          <li key={m.groups.id}>
            <Link href={`/groups/${m.groups.id}`} className="card block p-5 hover:border-brand-200">
              <div className="flex items-start gap-2"><h2 className="font-semibold">{m.groups.name}</h2>
                {m.groups.visibility === "public" ? <Globe className="ml-auto mt-1 h-4 w-4 shrink-0 text-muted" aria-label="Public" /> : <Lock className="ml-auto mt-1 h-4 w-4 shrink-0 text-muted" aria-label="Private" />}</div>
              {m.groups.semesters && <p className="text-xs text-muted">{m.groups.semesters.courses?.colleges?.name} · {m.groups.semesters.courses?.name} · {termName(m.groups.semesters.courses?.term_label, m.groups.semesters.semester_number)}</p>}
              <div className="mt-2 flex gap-2"><span className="badge capitalize">{m.role}</span>{m.membership_status === "pending" && <span className="badge !bg-warn/10 !text-warn">Waiting for approval</span>}</div>
            </Link></li>))}</ul>)}
    </>
  );
}
