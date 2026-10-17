import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText } from "lucide-react";
import { PageHeader } from "@/components/ui/misc";
import { isUuid, semesterAccess } from "@/lib/semester";
import { createClient } from "@/lib/server-db";
import { CATEGORIES, QUESTION_TYPES } from "@/lib/format";

export default async function SubjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const supabase = await createClient();
  const { data: subject } = await supabase.from("subjects").select("id,name,code,semester_id").eq("id", id).maybeSingle();
  if (!subject) notFound();
  const a = await semesterAccess(subject.semester_id);
  if (!a.canRead) notFound(); // hide private semester content from non-members
  const [docs, qs, posts] = await Promise.all([
    supabase.from("documents").select("id,title,category").eq("subject_id", id).neq("moderation_status", "removed").order("created_at", { ascending: false }).limit(20),
    supabase.from("exam_questions").select("id,question_text,question_type").eq("subject_id", id).eq("status", "visible").order("created_at", { ascending: false }).limit(20),
    supabase.from("discussion_posts").select("id,title").eq("subject_id", id).eq("status", "visible").order("created_at", { ascending: false }).limit(10),
  ]);
  return (<>
    <PageHeader title={subject.name} sub={subject.code ?? undefined}><Link href={`/semesters/${subject.semester_id}/subjects`} className="btn-secondary">All subjects</Link></PageHeader>
    <div className="grid gap-6 lg:grid-cols-3">
      <Block title="Shared PDFs" empty="No PDFs for this subject yet.">{docs.data?.map((d) => <li key={d.id}><a className="flex items-center gap-2 hover:text-brand-700" href={`/api/documents/${d.id}/file`} target="_blank"><FileText className="h-4 w-4" aria-hidden />{d.title}<span className="badge ml-auto">{CATEGORIES[d.category]}</span></a></li>)}</Block>
      <Block title="Important questions" empty="No questions yet.">{qs.data?.map((q) => <li key={q.id}><span className="line-clamp-2">{q.question_text}</span><span className="text-xs text-muted"> {QUESTION_TYPES[q.question_type]}</span></li>)}</Block>
      <Block title="Discussions" empty="No discussions yet.">{posts.data?.map((p) => <li key={p.id}><Link className="hover:text-brand-700" href={`/semesters/${subject.semester_id}/discussions/${p.id}`}>{p.title}</Link></li>)}</Block>
    </div></>);
}
function Block({ title, empty, children }: { title: string; empty: string; children: React.ReactNode }) {
  const has = Array.isArray(children) ? children.length > 0 : !!children;
  return <section className="card p-4"><h2 className="mb-3 text-sm font-semibold">{title}</h2>{has ? <ul className="space-y-2 text-sm">{children}</ul> : <p className="text-sm text-muted">{empty}</p>}</section>;
}
