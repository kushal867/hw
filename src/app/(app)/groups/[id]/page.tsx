import { BookMarked, FileText, MessagesSquare, Users } from "lucide-react";
import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { groupAccess, loadGroup } from "@/lib/group";
import { createClient } from "@/lib/server-db";
import { leaveGroup } from "@/app/actions/groups";

export default async function Overview({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await groupAccess(id);
  const group = await loadGroup(id);
  const supabase = await createClient();
  const head = (t: string) => supabase.from(t).select("id", { count: "exact", head: true }).eq("group_id", id);
  const [docs, posts, qs, members] = await Promise.all([head("documents"), head("discussion_posts"), head("exam_questions"), head("group_members").eq("membership_status", "active")]);
  const cards = [
    { href: "files", icon: FileText, label: "Shared PDFs", n: docs.count }, { href: "discussions", icon: MessagesSquare, label: "Discussions", n: posts.count },
    { href: "questions", icon: BookMarked, label: "Exam questions", n: qs.count }, { href: "members", icon: Users, label: "Members", n: members.count },
  ];
  return (
    <div className="space-y-6">
      {group?.description && <p className="whitespace-pre-line text-sm text-muted">{group.description}</p>}
      <ul className="grid grid-cols-2 gap-4 lg:grid-cols-4">{cards.map((c) => (
        <li key={c.href}><Link href={`/groups/${id}/${c.href}`} className="card block p-4 hover:border-brand-200">
          <c.icon className="mb-2 h-5 w-5 text-brand-600" aria-hidden /><p className="text-2xl font-bold">{c.n ?? 0}</p><p className="text-sm text-muted">{c.label}</p></Link></li>))}</ul>
      <p className="text-sm text-muted">Your role: <span className="badge capitalize">{a.role ?? "admin"}</span></p>
      {a.role && a.role !== "owner" && (
        <ActionForm action={async () => { "use server"; return leaveGroup(id); }} confirm="Leave this group? You'll lose access to its files and discussions.">
          <SubmitButton variant="secondary">Leave group</SubmitButton></ActionForm>)}
    </div>
  );
}
