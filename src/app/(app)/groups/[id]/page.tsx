import Link from "next/link";
import { BookMarked, FileText, Globe, LogOut, MessagesSquare, Lock } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { IconTile, SectionTitle } from "@/components/ui/misc";
import { groupAccess, loadGroup } from "@/lib/group";
import { createClient } from "@/lib/server-db";
import { formatDate, plural, timeAgo } from "@/lib/format";
import { leaveGroup } from "@/app/actions/groups";
import { EventRow } from "@/components/event-row";

const POLICY = { open: "Anyone can join instantly", approval: "People request to join and a moderator approves", invite_only: "Invitation only" } as const;

export default async function Overview({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await groupAccess(id);
  const group = await loadGroup(id);
  const supabase = await createClient();
  const { data: events } = await supabase.from("group_events").select("id,title,description,kind,starts_at").eq("group_id", id).gte("starts_at", new Date().toISOString()).order("starts_at").limit(3);
  const [docs, posts, qs, members] = await Promise.all([
    supabase.from("documents").select("id,title,created_at,profiles(display_name)").eq("group_id", id).neq("moderation_status", "removed").order("created_at", { ascending: false }).limit(5),
    supabase.from("discussion_posts").select("id,title,created_at,profiles(display_name)").eq("group_id", id).eq("status", "visible").order("created_at", { ascending: false }).limit(5),
    supabase.from("exam_questions").select("id,question_text,created_at,profiles(display_name)").eq("group_id", id).eq("status", "visible").order("created_at", { ascending: false }).limit(5),
    supabase.from("group_members").select("role, profiles(display_name, avatar_path)").eq("group_id", id).eq("membership_status", "active").order("joined_at").limit(8),
  ]);
  const feed = [
    ...(docs.data ?? []).map((d: any) => ({ k: "files" as const, id: d.id, text: d.title, at: d.created_at, by: d.profiles?.display_name, href: `/groups/${id}/files`, verb: "shared a PDF" })),
    ...(posts.data ?? []).map((d: any) => ({ k: "discussions" as const, id: d.id, text: d.title, at: d.created_at, by: d.profiles?.display_name, href: `/groups/${id}/discussions/${d.id}`, verb: "started a discussion" })),
    ...(qs.data ?? []).map((d: any) => ({ k: "questions" as const, id: d.id, text: d.question_text, at: d.created_at, by: d.profiles?.display_name, href: `/groups/${id}/questions`, verb: "added a question" })),
  ].sort((x, y) => +new Date(y.at) - +new Date(x.at)).slice(0, 8);
  const sem = group?.semesters;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-6">
      {!!events?.length && (
        <section aria-labelledby="upc"><SectionTitle action={<Link href={`/groups/${id}/events`} className="text-sm font-semibold text-brand-700 hover:underline">Calendar</Link>}><span id="upc">Coming up</span></SectionTitle>
          <ul className="card divide-y divide-line">{events.map((e: any) => <li key={e.id}><EventRow e={e} href={`/groups/${id}/events`} /></li>)}</ul></section>)}
      <section aria-labelledby="act">
        <SectionTitle><span id="act">Recent activity</span></SectionTitle>
        {!feed.length ? (
          <div className="card flex flex-col items-center px-6 py-12 text-center">
            <p className="font-bold">It&apos;s quiet in here</p>
            <p className="mt-1 max-w-sm text-sm leading-relaxed text-muted">Be the first to share a PDF, start a discussion, or add an important question.</p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <Link href={`/groups/${id}/files`} className="btn-primary">Upload a PDF</Link>
              <Link href={`/groups/${id}/discussions`} className="btn-secondary">Start a discussion</Link>
            </div>
          </div>
        ) : (
          <ul className="card divide-y divide-line">{feed.map((i) => (
            <li key={`${i.k}-${i.id}`}><Link href={i.href} className="flex items-start gap-3.5 p-4 transition hover:bg-slate-50">
              <IconTile icon={i.k === "files" ? FileText : i.k === "discussions" ? MessagesSquare : BookMarked} tone={i.k} size={40} />
              <div className="min-w-0"><p className="text-sm"><span className="font-semibold">{i.by ?? "Someone"}</span> <span className="text-muted">{i.verb}</span></p>
                <p className="mt-0.5 line-clamp-1 font-semibold">{i.text}</p><p className="mt-0.5 text-xs text-muted">{timeAgo(i.at)}</p></div></Link></li>))}</ul>)}
      </section>
      </div>

      <aside className="space-y-5">
        <section className="card p-5" aria-labelledby="about">
          <h2 id="about" className="font-bold">About this group</h2>
          {group?.description ? <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-700">{group.description}</p> : <p className="mt-2 text-sm text-muted">No description yet.</p>}
          <div className="mt-4 space-y-2.5 text-sm">
            <div className="flex items-start gap-2.5">{group?.visibility === "public" ? <Globe className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden /> : <Lock className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden />}
              <div><span className="sr-only">Visibility: </span><p><span className="font-semibold">{group?.visibility === "public" ? "Public group" : "Private group"}</span><br /><span className="text-muted">{group ? POLICY[group.join_policy] : ""}</span></p></div></div>
            {sem && <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600"><span className="font-semibold text-slate-800">{sem.courses.colleges.name}</span><br />{sem.courses.name} · Semester {sem.semester_number}</div>}
          </div>
          <p className="mt-3 text-xs text-muted">Your role: <span className="font-semibold capitalize text-ink">{a.role ?? "admin"}</span></p>
        </section>

        <section className="card p-5" aria-labelledby="mem">
          <div className="flex items-center justify-between"><h2 id="mem" className="font-bold">Members</h2><Link href={`/groups/${id}/members`} className="text-sm font-semibold text-brand-700 hover:underline">See all</Link></div>
          <ul className="mt-3 flex flex-wrap gap-2">{(members.data ?? []).map((m: any, i: number) => (
            <li key={i} title={`${m.profiles?.display_name} (${m.role})`}><Avatar name={m.profiles?.display_name ?? "?"} path={m.profiles?.avatar_path} size={40} /></li>))}</ul>
          <p className="mt-2 text-xs text-muted">{plural(members.data?.length ?? 0, "member")} shown</p>
        </section>

        {a.role && a.role !== "owner" && (
          <ActionForm action={async () => { "use server"; return leaveGroup(id); }} confirm="Leave this group? You'll lose access to its files and discussions.">
            <SubmitButton variant="ghost" className="w-full !justify-start text-slate-600"><LogOut className="h-4 w-4" aria-hidden />Leave group</SubmitButton></ActionForm>)}
      </aside>
    </div>
  );
}
