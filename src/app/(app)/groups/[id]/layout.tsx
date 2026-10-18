import Link from "next/link";
import { Globe, Lock, Plus, Upload, Users } from "lucide-react";
import { GroupTabs } from "@/components/group-tabs";
import { GroupAvatar, groupGradient } from "@/components/group-avatar";
import { JoinGroupButton } from "@/components/join-group-button";
import { groupAccess, loadGroup, isUuid } from "@/lib/group";
import { createClient } from "@/lib/server-db";
import { plural, termName } from "@/lib/format";
import { notFound } from "next/navigation";

const POLICY = { open: "Anyone can join", approval: "Join requests are approved by moderators", invite_only: "Invitation only" } as const;

const Cover = ({ id }: { id: string }) => (
  <div aria-hidden className="relative h-14 overflow-hidden rounded-t-3xl sm:h-24" style={{ background: groupGradient(id) }}>
    <div className="absolute inset-0 opacity-30" style={{ backgroundImage: "radial-gradient(circle at 20% 20%, white 0, transparent 40%), radial-gradient(circle at 85% 80%, white 0, transparent 35%)" }} />
  </div>
);

export default async function GroupLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const a = await groupAccess(id);
  const group = await loadGroup(id);

  // Private groups (and unknown ids) look identical to outsiders: nothing is revealed.
  if (!group) {
    return (
      <div className="card mx-auto mt-10 max-w-md p-8 text-center">
        <span className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-600"><Lock className="h-6 w-6" aria-hidden /></span>
        <h1 className="text-lg font-bold">This group is private or doesn&apos;t exist</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">Ask a member for an invitation link or QR code.</p>
        <Link href="/find-groups" className="btn-primary mt-5">Find public groups</Link>
      </div>);
  }
  const where = group.semesters ? `${group.semesters.courses.colleges.name} · ${group.semesters.courses.name} · ${termName(group.semesters.courses.term_label, group.semesters.semester_number)}` : null;

  const supabase = await createClient();
  if (!a.canRead) {
    // Public group, not a member: show the group card and the join action, never its content.
    const [{ data: dir }, { data: mine }] = await Promise.all([
      supabase.from("group_directory").select("member_count").eq("id", id).maybeSingle(),
      supabase.from("group_members").select("membership_status").eq("group_id", id).eq("user_id", a.user.id).maybeSingle(),
    ]);
    return (
      <div className="card mx-auto mt-2 max-w-2xl overflow-hidden">
        <Cover id={id} />
        <div className="relative px-6 pb-7 sm:px-8">
          <GroupAvatar name={group.name} seed={id} size={84} className="-mt-11 ring-4 ring-surface" />
          <p className="mt-3"><span className="badge"><Globe className="h-3 w-3" aria-hidden />Public group</span></p>
          <h1 className="mt-2 text-2xl font-extrabold">{group.name}</h1>
          {where && <p className="mt-1 text-sm text-muted">{where}</p>}
          {group.description && <p className="mt-4 whitespace-pre-line leading-relaxed">{group.description}</p>}
          <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted"><span className="flex items-center gap-1.5"><Users className="h-4 w-4" aria-hidden />{plural(dir?.member_count ?? 0, "member")}</span><span>{POLICY[group.join_policy]}</span></p>
          <div className="mt-6">
            {mine?.membership_status === "pending" ? <p className="rounded-xl bg-brand-50 p-3.5 text-sm font-medium text-brand-700">Your request is waiting for approval. We&apos;ll notify you.</p>
              : mine?.membership_status === "removed" ? <p className="text-sm text-muted">You can&apos;t rejoin this group.</p>
              : group.join_policy === "invite_only" ? <p className="rounded-xl bg-slate-100 p-3.5 text-sm text-slate-600">This group is joined by invitation. Ask a member for a link.</p>
              : <JoinGroupButton groupId={id} label={group.join_policy === "open" ? "Join group" : "Request to join"} />}
          </div>
          <p className="mt-5 text-xs text-muted">Files and discussions are visible to members only.</p>
        </div>
      </div>);
  }

  const head = (t: string, extra?: (q: any) => any) => { const q = supabase.from(t).select("id", { count: "exact", head: true }).eq("group_id", id); return extra ? extra(q) : q; };
  const [files, posts, qs, members] = await Promise.all([head("documents", (q) => q.neq("moderation_status", "removed")), head("discussion_posts"), head("exam_questions"), head("group_members", (q) => q.eq("membership_status", "active"))]);
  const counts = { files: files.count ?? 0, discussions: posts.count ?? 0, questions: qs.count ?? 0, members: members.count ?? 0 };

  return (<div className="space-y-6">
    <header className="card overflow-hidden">
      <Cover id={id} />
      <div className="relative flex flex-wrap items-start gap-x-5 gap-y-2 px-5 pb-5 sm:gap-y-3 sm:px-8 sm:pb-6">
        <GroupAvatar name={group.name} seed={id} size={72} className="-mt-9 ring-4 ring-surface sm:-mt-12 sm:!h-20 sm:!w-20" />
        <div className="min-w-0 flex-1 basis-48 pt-3 sm:basis-64 sm:pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="break-words text-xl font-extrabold leading-tight sm:text-[28px]">{group.name}</h1>
            <span className="badge-muted">{group.visibility === "public" ? <Globe className="h-3 w-3" aria-hidden /> : <Lock className="h-3 w-3" aria-hidden />}{group.visibility === "public" ? "Public" : "Private"}</span>
          </div>
          <p className="mt-1 text-sm text-muted">{[where, plural(counts.members, "member")].filter(Boolean).join(" · ")}</p>
        </div>
        <div className="flex w-full flex-wrap gap-2 pt-1 sm:w-auto sm:pt-4">
          <Link href={`/groups/${id}/files`} className="btn-secondary hidden sm:inline-flex"><Upload className="h-4 w-4" aria-hidden />Upload PDF</Link>
          {a.canModerate && <Link href={`/groups/${id}/settings`} className="btn-primary"><Plus className="h-4 w-4" aria-hidden />Invite people</Link>}
        </div>
      </div>
    </header>
    <GroupTabs id={id} canModerate={a.canModerate} hasSubjects={!!group.semester_id} counts={counts} />
    <div>{children}</div>
  </div>);
}
