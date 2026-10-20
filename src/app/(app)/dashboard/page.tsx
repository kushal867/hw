import Link from "next/link";
import { BookMarked, Check, Compass, FileDown, FileText, MessagesSquare, Plus, Sparkles, Upload, Users } from "lucide-react";
import { GroupAvatar } from "@/components/group-avatar";
import { EmptyState, IconTile, SectionTitle } from "@/components/ui/misc";
import { EventRow } from "@/components/event-row";
import { GroupCard } from "@/components/public/cards";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/server-db";
import { termName, timeAgo } from "@/lib/format";

export const metadata = { title: "Home" };

type Item = { id: string; kind: "files" | "discussions" | "questions"; text: string; at: string; href: string; group: string };

export default async function Dashboard() {
  const { profile } = await requireUser();
  const supabase = await createClient();
  const { data: memberships } = await supabase.from("group_members")
    .select("role, groups(id, name, status, visibility, semesters(semester_number, courses(name, term_label, colleges(name))))").eq("user_id", profile.id).eq("membership_status", "active");
  const active = ((memberships ?? []) as any[]).filter((m) => m.groups?.status === "active");
  const ids = active.map((m) => m.groups.id as string);
  const nameOf = new Map(active.map((m) => [m.groups.id as string, m.groups.name as string]));

  // Row Level Security already limits these to the user's groups; the in() filter just scopes the feed.
  const [docs, posts, qs] = ids.length ? await Promise.all([
    supabase.from("documents").select("id,title,created_at,group_id").in("group_id", ids).neq("moderation_status", "removed").order("created_at", { ascending: false }).limit(6),
    supabase.from("discussion_posts").select("id,title,created_at,group_id").in("group_id", ids).eq("status", "visible").order("created_at", { ascending: false }).limit(6),
    supabase.from("exam_questions").select("id,question_text,created_at,group_id").in("group_id", ids).eq("status", "visible").order("created_at", { ascending: false }).limit(6),
  ]) : [null, null, null];
  const feed: Item[] = [
    ...(docs?.data ?? []).map((d: any): Item => ({ id: d.id, kind: "files", text: d.title, at: d.created_at, href: `/groups/${d.group_id}/files`, group: nameOf.get(d.group_id) ?? "" })),
    ...(posts?.data ?? []).map((d: any): Item => ({ id: d.id, kind: "discussions", text: d.title, at: d.created_at, href: `/groups/${d.group_id}/discussions/${d.id}`, group: nameOf.get(d.group_id) ?? "" })),
    ...(qs?.data ?? []).map((d: any): Item => ({ id: d.id, kind: "questions", text: d.question_text, at: d.created_at, href: `/groups/${d.group_id}/questions`, group: nameOf.get(d.group_id) ?? "" })),
  ].sort((a, b) => +new Date(b.at) - +new Date(a.at)).slice(0, 8);

  // Next 5 exams / deadlines across all my groups (row-level security already limits this to groups I belong to).
  const { data: upcoming } = ids.length ? await supabase.from("group_events").select("id,title,description,kind,starts_at,group_id").in("group_id", ids).gte("starts_at", new Date().toISOString()).order("starts_at").limit(5) : { data: [] as any[] };
  // Public groups that match my profile (same semester, else program, else college) that I have not joined yet.
  let picks: any[] = [];
  const near = profile.semester_id ? { col: "semester_id", val: profile.semester_id } : profile.course_id ? { col: "course_id", val: profile.course_id } : profile.college_id ? { col: "college_id", val: profile.college_id } : null;
  if (near) {
    const { data } = await supabase.from("group_directory").select("*").eq(near.col, near.val).order("member_count", { ascending: false }).limit(8);
    picks = (data ?? []).filter((g: any) => !ids.includes(g.id)).slice(0, 3);
  }

  const first = ids[0];
  const steps = [
    { done: !!(profile.bio || profile.college_id || profile.avatar_path), label: "Complete your profile", href: "/profile" },
    { done: ids.length > 0, label: "Create a group or join one", href: "/find-groups" },
    { done: !!docs?.data?.length, label: "Upload your first PDF", href: first ? `/groups/${first}/files` : "/groups/new" },
    { done: !!posts?.data?.length || !!qs?.data?.length, label: "Start a discussion or add a question", href: first ? `/groups/${first}/discussions` : "/groups/new" },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const quick = [
    { href: first ? `/groups/${first}/files` : "/groups/new", icon: Upload, label: "Upload a PDF", tone: "files" as const },
    { href: first ? `/groups/${first}/discussions` : "/groups/new", icon: MessagesSquare, label: "Ask a question", tone: "discussions" as const },
    { href: first ? `/groups/${first}/questions` : "/groups/new", icon: BookMarked, label: "Add exam question", tone: "questions" as const },
    { href: "/pdf-maker", icon: FileDown, label: "Make a study PDF", tone: "members" as const },
  ];
  const firstName = profile.display_name.split(" ")[0];

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 via-indigo-600 to-violet-600 p-5 text-white shadow-pop sm:p-8">
        <div aria-hidden className="absolute -right-10 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" /><div aria-hidden className="absolute -bottom-20 right-24 h-52 w-52 rounded-full bg-fuchsia-400/20 blur-3xl" />
        <div className="relative max-w-xl">
          <p className="text-sm font-semibold text-indigo-100">Namaste</p>
          <h1 className="mt-1 text-2xl font-extrabold sm:text-4xl">{firstName}, let&apos;s study together.</h1>
          <p className="mt-2 hidden text-[15px] leading-relaxed text-indigo-100 sm:block">{ids.length ? "Pick up where your classmates left off, or share something new today." : "Create a group for your class or homework, or find one your classmates already use."}</p>
          <div className="mt-4 flex flex-wrap gap-2 sm:mt-5 sm:gap-2.5">
            <Link href="/groups/new" className="btn sm:btn-lg bg-white text-brand-700 hover:bg-indigo-50"><Plus className="h-4 w-4" aria-hidden />Create a group</Link>
            <Link href="/find-groups" className="btn sm:btn-lg border border-white/30 bg-white/10 text-white hover:bg-white/20"><Compass className="h-4 w-4" aria-hidden />Find groups</Link>
          </div>
        </div>
      </section>

      <section aria-label="Quick actions"><ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">{quick.map((q) => (
        <li key={q.label}><Link href={q.href} className="card card-hover flex h-full items-center gap-3 p-3 sm:flex-col sm:items-start sm:p-4"><IconTile icon={q.icon} tone={q.tone} /><span className="text-sm font-bold leading-snug">{q.label}</span></Link></li>))}</ul></section>

      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="space-y-8">
          {!!upcoming?.length && (
            <section aria-labelledby="dl-m" className="lg:hidden"><SectionTitle action={<span className="text-xs font-semibold text-muted">{upcoming.length} upcoming</span>}><span id="dl-m">Coming up</span></SectionTitle>
              <ul className="card divide-y divide-line">{upcoming.slice(0, 3).map((e: any) => <li key={e.id}><EventRow e={e} group={nameOf.get(e.group_id)} href={`/groups/${e.group_id}/events`} /></li>)}</ul></section>)}
          <section aria-labelledby="mg"><SectionTitle action={ids.length > 0 ? <Link href="/my-groups" className="text-sm font-semibold text-brand-700 hover:underline">See all</Link> : undefined}><span id="mg">Your groups</span></SectionTitle>
            {!active.length ? (
              <EmptyState icon={Users} title="You're not in a group yet" action={<div className="flex flex-wrap justify-center gap-2"><Link href="/groups/new" className="btn-primary">Create a group</Link><Link href="/find-groups" className="btn-secondary">Find groups</Link></div>}>
                Groups are where classmates share PDFs, ask questions and prepare for exams together.</EmptyState>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2">{active.slice(0, 6).map((m) => (
                <li key={m.groups.id}><Link href={`/groups/${m.groups.id}`} className="card card-hover flex items-center gap-3.5 p-4">
                  <GroupAvatar name={m.groups.name} seed={m.groups.id} size={52} />
                  <div className="min-w-0"><p className="truncate font-bold">{m.groups.name}</p>
                    <p className="truncate text-xs text-muted">{m.groups.semesters ? `${m.groups.semesters.courses?.name} · ${termName(m.groups.semesters.courses?.term_label, m.groups.semesters.semester_number)}` : m.groups.visibility === "public" ? "Public group" : "Private group"}</p>
                    <span className="badge-muted mt-1.5 capitalize">{m.role}</span></div></Link></li>))}</ul>)}
          </section>

          {picks.length > 0 && (
            <section aria-labelledby="gfy"><SectionTitle action={<Link href="/find-groups" className="text-sm font-semibold text-brand-700 hover:underline">More</Link>}><span id="gfy">Groups for you</span></SectionTitle>
              <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{picks.map((g: any) => <li key={g.id}><GroupCard g={g} /></li>)}</ul></section>)}

          {ids.length > 0 && (
            <section aria-labelledby="act"><SectionTitle><span id="act">Latest activity</span></SectionTitle>
              {!feed.length ? <div className="card p-6 text-center text-sm text-muted">Nothing yet. Upload a PDF or start a discussion to get things moving.</div> : (
                <ul className="card divide-y divide-line">{feed.map((i) => (
                  <li key={`${i.kind}-${i.id}`}><Link href={i.href} className="flex items-start gap-3.5 p-4 transition hover:bg-slate-50">
                    <IconTile icon={i.kind === "files" ? FileText : i.kind === "discussions" ? MessagesSquare : BookMarked} tone={i.kind} size={38} />
                    <div className="min-w-0"><p className="line-clamp-1 text-sm font-semibold">{i.text}</p><p className="mt-0.5 text-xs text-muted">{i.group} · {timeAgo(i.at)}</p></div></Link></li>))}</ul>)}
            </section>)}
        </div>

        <aside className="space-y-6">
          {!!upcoming?.length && (
            <section aria-labelledby="dl" className="hidden lg:block"><SectionTitle><span id="dl">Coming up</span></SectionTitle>
              <ul className="card divide-y divide-line">{upcoming.map((e: any) => <li key={e.id}><EventRow e={e} group={nameOf.get(e.group_id)} href={`/groups/${e.group_id}/events`} /></li>)}</ul></section>)}
          {doneCount < steps.length && (
            <section className="card p-5" aria-labelledby="gs">
              <div className="mb-1 flex items-center gap-2"><Sparkles className="h-4 w-4 text-brand-600" aria-hidden /><h2 id="gs" className="font-bold">Getting started</h2></div>
              <p className="text-xs text-muted">{doneCount} of {steps.length} done</p>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={doneCount} aria-valuemin={0} aria-valuemax={steps.length} aria-label="Getting started progress"><div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-violet-500 transition-all" style={{ width: `${(doneCount / steps.length) * 100}%` }} /></div>
              <ol className="mt-4 space-y-1">{steps.map((s) => (
                <li key={s.label}><Link href={s.href} className="flex items-center gap-3 rounded-xl px-2 py-2 text-sm transition hover:bg-slate-50">
                  <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 ${s.done ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300"}`}>{s.done && <Check className="h-3.5 w-3.5" aria-hidden />}</span>
                  <span className={s.done ? "text-muted line-through" : "font-medium"}>{s.label}</span></Link></li>))}</ol>
            </section>)}
          <section className="card bg-gradient-to-br from-brand-50 to-white p-5"><h2 className="font-bold">Invite classmates</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted">Open any group you own, go to Manage, and create a link or QR code. It expires, so it stays safe.</p></section>
        </aside>
      </div>
    </div>
  );
}
