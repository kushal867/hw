import Link from "next/link";
import { Check, Circle, FileDown, MessagesSquare, QrCode, Upload, FileText } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/server-db";
import { formatDate, termName } from "@/lib/format";

export const metadata = { title: "Dashboard" };

export default async function Dashboard() {
  const { profile } = await requireUser();
  const supabase = await createClient();
  const { data: memberships } = await supabase.from("group_members")
    .select("role, groups(id, name, status, semesters(semester_number, courses(name, term_label, colleges(name))))").eq("user_id", profile.id).eq("membership_status", "active");
  const active = ((memberships ?? []) as any[]).filter((m) => m.groups?.status === "active");
  const semIds = active.map((m) => m.groups.id);
  // RLS already limits these to the user's semesters; the in() filter just scopes the dashboard.
  const [docs, posts, qs] = semIds.length ? await Promise.all([
    supabase.from("documents").select("id,title,created_at,group_id").in("group_id", semIds).neq("moderation_status", "removed").order("created_at", { ascending: false }).limit(5),
    supabase.from("discussion_posts").select("id,title,created_at,group_id").in("group_id", semIds).eq("status", "visible").order("created_at", { ascending: false }).limit(5),
    supabase.from("exam_questions").select("id,question_text,created_at,group_id").in("group_id", semIds).eq("status", "visible").order("created_at", { ascending: false }).limit(5),
  ]) : [null, null, null];

  const steps = [
    { done: !!(profile.bio || profile.college_id || profile.avatar_path), label: "Complete your profile", href: "/profile" },
    { done: semIds.length > 0, label: "Create a group or join one with a link, QR code or search", href: "/find-groups" },
    { done: semIds.length > 0 && !!docs?.data?.length, label: "Upload or discover study materials", href: semIds[0] ? `/groups/${semIds[0]}/files` : "/public-notes" },
  ];

  return (
    <>
      <PageHeader title={`Namaste, ${profile.display_name}`} sub="Here's what's happening in your groups.">
        <Link href="/find-groups" className="btn-secondary"><QrCode className="h-4 w-4" aria-hidden />Join Group</Link>
        <Link href="/groups/new" className="btn-secondary">Create Group</Link>
        <Link href="/pdf-maker" className="btn-secondary"><FileDown className="h-4 w-4" aria-hidden />Create PDF</Link>
        {semIds[0] && <Link href={`/groups/${semIds[0]}/files`} className="btn-primary"><Upload className="h-4 w-4" aria-hidden />Quick Upload</Link>}
      </PageHeader>

      {!semIds.length && (
        <section className="card mb-6 p-5" aria-labelledby="onb">
          <h2 id="onb" className="font-semibold">Get started</h2>
          <ol className="mt-3 space-y-2">
            {steps.map((s) => (
              <li key={s.label}><Link href={s.href} className="flex items-center gap-3 rounded-control px-2 py-2 text-sm hover:bg-brand-50">
                {s.done ? <Check className="h-4 w-4 text-success" aria-label="done" /> : <Circle className="h-4 w-4 text-muted" aria-label="to do" />}{s.label}</Link></li>))}
          </ol>
        </section>)}

      <section className="mb-8" aria-labelledby="ms"><h2 id="ms" className="mb-3 font-semibold">My Groups</h2>
        {!active.length ? <EmptyState icon={QrCode} title="You're not in a group yet" action={<div className="flex gap-2"><Link href="/groups/new" className="btn-primary">Create a group</Link><Link href="/find-groups" className="btn-secondary">Find groups</Link></div>}>
          Start a group for your class or homework, join one with an invitation link or QR code, or search public groups.</EmptyState> : (
          <ul className="grid gap-4 sm:grid-cols-2">{active.map((m: any) => (
            <li key={m.groups.id}><Link href={`/groups/${m.groups.id}`} className="card block p-5 hover:border-brand-200">
              {m.groups.semesters && <p className="text-xs text-muted">{m.groups.semesters.courses?.colleges?.name} · {m.groups.semesters.courses?.name} · {termName(m.groups.semesters.courses?.term_label, m.groups.semesters.semester_number)}</p>}
              <p className="font-semibold">{m.groups.name}</p>
              <span className="badge mt-2 capitalize">{m.role}</span></Link></li>))}</ul>)}
      </section>

      {semIds.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-3">
          <Recent title="Recent study materials" icon={FileText} empty="No files yet." items={(docs?.data ?? []).map((d) => ({ id: d.id, text: d.title, at: d.created_at, href: `/groups/${d.group_id}/files` }))} />
          <Recent title="Recent discussions" icon={MessagesSquare} empty="No discussions yet." items={(posts?.data ?? []).map((d) => ({ id: d.id, text: d.title, at: d.created_at, href: `/groups/${d.group_id}/discussions/${d.id}` }))} />
          <Recent title="Recently added questions" icon={FileText} empty="No questions yet." items={(qs?.data ?? []).map((d) => ({ id: d.id, text: d.question_text, at: d.created_at, href: `/groups/${d.group_id}/questions` }))} />
        </div>)}
    </>
  );
}

function Recent({ title, icon: Icon, items, empty }: { title: string; icon: typeof FileText; items: { id: string; text: string; at: string; href: string }[]; empty: string }) {
  return (
    <section className="card p-4" aria-label={title}>
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold"><Icon className="h-4 w-4 text-brand-600" aria-hidden />{title}</h3>
      {!items.length ? <p className="text-sm text-muted">{empty}</p> : (
        <ul className="space-y-2">{items.map((i) => (
          <li key={i.id}><Link href={i.href} className="block rounded-control p-2 hover:bg-brand-50"><span className="line-clamp-1 text-sm">{i.text}</span><span className="text-xs text-muted">{formatDate(i.at)}</span></Link></li>))}</ul>)}
    </section>
  );
}
