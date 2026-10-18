import Link from "next/link";
import { Lock, Globe, Users } from "lucide-react";
import { GroupTabs } from "@/components/group-tabs";
import { JoinGroupButton } from "@/components/join-group-button";
import { PageHeader } from "@/components/ui/misc";
import { groupAccess, loadGroup, isUuid } from "@/lib/group";
import { termName } from "@/lib/format";
import { createClient } from "@/lib/server-db";
import { notFound } from "next/navigation";

const POLICY = { open: "Anyone can join", approval: "Join requests are approved by moderators", invite_only: "Invitation only" } as const;

export default async function GroupLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const a = await groupAccess(id);
  const group = await loadGroup(id);

  // Private groups (and unknown ids) look identical to outsiders: nothing is revealed.
  if (!group) {
    return (
      <div className="card mx-auto mt-10 max-w-md p-8 text-center">
        <Lock className="mx-auto mb-3 h-6 w-6 text-brand-600" aria-hidden />
        <h1 className="text-lg font-bold">This group is private or doesn&apos;t exist</h1>
        <p className="mt-2 text-sm text-muted">Ask a member for an invitation link or QR code.</p>
        <Link href="/find-groups" className="btn-primary mt-5">Find public groups</Link>
      </div>);
  }

  if (!a.canRead) {
    // Public group, not a member: show the group card and the join action, never its content.
    const { data: dir } = await (await createClient()).from("group_directory").select("member_count").eq("id", id).maybeSingle();
    const { data: mine } = await (await createClient()).from("group_members").select("membership_status").eq("group_id", id).eq("user_id", a.user.id).maybeSingle();
    return (
      <div className="card mx-auto mt-6 max-w-xl p-6">
        <span className="badge"><Globe className="mr-1 h-3 w-3" aria-hidden />Public group</span>
        <h1 className="mt-3 text-2xl font-bold">{group.name}</h1>
        {group.semesters && <p className="text-sm text-muted">{group.semesters.courses.colleges.name} · {group.semesters.courses.name} · {termName(group.semesters.courses.term_label, group.semesters.semester_number)}</p>}
        {group.description && <p className="mt-3 whitespace-pre-line">{group.description}</p>}
        <p className="mt-3 flex items-center gap-2 text-sm text-muted"><Users className="h-4 w-4" aria-hidden />{dir?.member_count ?? 0} members · {POLICY[group.join_policy]}</p>
        <div className="mt-5">
          {mine?.membership_status === "pending" ? <p className="rounded-control bg-brand-50 p-3 text-sm text-brand-700">Your request is waiting for approval.</p>
            : mine?.membership_status === "removed" ? <p className="text-sm text-muted">You can&apos;t rejoin this group.</p>
            : group.join_policy === "invite_only" ? <p className="text-sm text-muted">This group is joined by invitation. Ask a member for a link.</p>
            : <JoinGroupButton groupId={id} label={group.join_policy === "open" ? "Join group" : "Request to join"} />}
        </div>
        <p className="mt-4 text-xs text-muted">Files and discussions are visible to members only.</p>
      </div>);
  }

  return (<>
    <PageHeader title={group.name} sub={group.semesters ? `${group.semesters.courses.colleges.name} · ${group.semesters.courses.name} · ${termName(group.semesters.courses.term_label, group.semesters.semester_number)}` : group.description ?? undefined}>
      <span className="badge">{group.visibility === "public" ? <Globe className="mr-1 h-3 w-3" aria-hidden /> : <Lock className="mr-1 h-3 w-3" aria-hidden />}{group.visibility}</span>
    </PageHeader>
    <GroupTabs id={id} canModerate={a.canModerate} hasSubjects={!!group.semester_id} />
    <div className="mt-6">{children}</div>
  </>);
}
