import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/server-db";
import { createAdminClient } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { moderate } from "@/app/actions/community";

export const metadata = { title: "Moderator" };

// Semester moderators only see reports about content inside the semesters they moderate.
export default async function Moderator() {
  const { profile } = await requireUser();
  const { data: mine } = await (await createClient()).from("group_members").select("group_id").eq("user_id", profile.id).eq("membership_status", "active").in("role", ["owner", "moderator"]);
  const semIds = (mine ?? []).map((m) => m.group_id);
  if (!semIds.length) return <div className="mx-auto max-w-2xl p-8"><EmptyState icon={ShieldCheck} title="You don't moderate any semester" action={<Link href="/dashboard" className="btn-primary">Back to dashboard</Link>} /></div>;
  const db = createAdminClient();
  const [posts, comments] = await Promise.all([
    db.from("discussion_posts").select("id,title,group_id,status").in("group_id", semIds),
    db.from("discussion_comments").select("id,body,status,post_id,discussion_posts!inner(group_id)").in("discussion_posts.group_id", semIds),
  ]);
  const postMap = new Map(posts.data?.map((p) => [p.id, p])); const comMap = new Map(comments.data?.map((c: any) => [c.id, c]));
  const ids = [...postMap.keys(), ...comMap.keys()];
  const { data: reports } = ids.length ? await db.from("reports").select("*").eq("status", "open").in("target_id", ids).in("target_type", ["post", "comment"]).order("created_at", { ascending: false }) : { data: [] };
  return (<div className="mx-auto max-w-3xl px-4 py-8"><PageHeader title="Moderation" sub="Open reports in your semesters." />
    {!reports?.length ? <EmptyState icon={ShieldCheck} title="No open reports" /> : <ul className="space-y-3">{reports.map((r: any) => {
      const item: any = r.target_type === "post" ? postMap.get(r.target_id) : comMap.get(r.target_id);
      const sem = r.target_type === "post" ? item.group_id : item.discussion_posts.group_id;
      return (<li key={r.id} className="card p-4"><span className="badge capitalize">{r.target_type}</span> <span className="badge !bg-line !text-muted">{r.reason}</span>
        <p className="mt-2 text-sm">{item.title ?? item.body}</p><p className="mt-1 text-xs text-muted">{r.details} · {formatDate(r.created_at)}</p>
        <div className="mt-3"><ActionForm action={async () => { "use server"; return moderate(sem, r.target_type, r.target_id, "hidden"); }}><SubmitButton variant="danger">Hide content</SubmitButton></ActionForm></div></li>);
    })}</ul>}</div>);
}
