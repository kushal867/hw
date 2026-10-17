import Link from "next/link";
import { BookMarked, FileText, MessagesSquare, Users } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { semesterAccess } from "@/lib/semester";
import { createClient } from "@/lib/server-db";
import { leaveSemester } from "@/app/actions/semesters";

export default async function Overview({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await semesterAccess(id);
  const supabase = await createClient();
  const head = (t: string) => supabase.from(t).select("id", { count: "exact", head: true }).eq("semester_id", id);
  const [docs, posts, qs, members, subjects] = await Promise.all([head("documents"), head("discussion_posts"), head("exam_questions"),
    head("semester_members").eq("membership_status", "active"), head("subjects")]);
  const cards = [
    { href: "files", icon: FileText, label: "Shared PDFs", n: docs.count }, { href: "discussions", icon: MessagesSquare, label: "Discussions", n: posts.count },
    { href: "questions", icon: BookMarked, label: "Exam questions", n: qs.count }, { href: "members", icon: Users, label: "Members", n: members.count },
  ];
  return (
    <div className="space-y-6">
      <ul className="grid grid-cols-2 gap-4 lg:grid-cols-4">{cards.map((c) => (
        <li key={c.href}><Link href={`/semesters/${id}/${c.href}`} className="card block p-4 hover:border-brand-200">
          <c.icon className="mb-2 h-5 w-5 text-brand-600" aria-hidden /><p className="text-2xl font-bold">{c.n ?? 0}</p><p className="text-sm text-muted">{c.label}</p></Link></li>))}</ul>
      <p className="text-sm text-muted">{subjects.count ?? 0} subjects · Your role: <span className="badge capitalize">{a.role ?? "admin"}</span></p>
      {a.role && a.role !== "owner" && (
        <ActionForm action={async () => { "use server"; return leaveSemester(id); }} confirm="Leave this semester? You'll lose access to its files and discussions.">
          <SubmitButton variant="secondary">Leave semester</SubmitButton></ActionForm>)}
    </div>
  );
}
