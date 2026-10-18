import Link from "next/link";
import { Bookmark, BookmarkCheck, BookMarked, FileDown, Trash2, BadgeCheck } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { EmptyState, Pagination } from "@/components/ui/misc";
import { groupAccess, loadGroup } from "@/lib/group";
import { createClient } from "@/lib/supabase/server";
import { QUESTION_TYPES } from "@/lib/format";
import { addQuestion, confirmQuestion, deleteQuestion, toggleSaved } from "@/app/actions/community";

export const metadata = { title: "Exam questions" };
const PAGE = 15;

export default async function Questions({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { id } = await params; const sp = await searchParams;
  const a = await groupAccess(id);
  const page = Math.max(1, Number(sp.page) || 1);
  const supabase = await createClient();
  const group = await loadGroup(id);
  const { data: subjects } = group?.semester_id ? await supabase.from("subjects").select("id,name").eq("semester_id", group.semester_id).order("name") : { data: [] as { id: string; name: string }[] };
  let q = supabase.from("exam_questions").select("id,question_text,answer_text,topic,question_type,source_note,created_by,subjects(name),profiles(display_name)").eq("group_id", id).eq("status", "visible").order("created_at", { ascending: false });
  if (sp.subject) q = q.eq("subject_id", sp.subject);
  if (sp.type && QUESTION_TYPES[sp.type]) q = q.eq("question_type", sp.type);
  const { data } = await q.range((page - 1) * PAGE, page * PAGE);
  const rows = (data ?? []).slice(0, PAGE) as any[];
  const { data: saved } = await supabase.from("saved_questions").select("question_id").eq("user_id", a.user.id);
  const savedSet = new Set(saved?.map((s) => s.question_id));
  const base = `/groups/${id}/questions?` + new URLSearchParams(Object.entries(sp).filter(([k, v]) => v && k !== "page") as [string, string][]).toString();
  return (
    <div className="space-y-6">
      <p className="rounded-control bg-brand-50 p-3 text-sm text-brand-700">Questions here are student-contributed study aids. They are <strong>not</strong> guaranteed to appear in any exam. Only questions labelled &ldquo;Teacher-Confirmed&rdquo; have passed verification.</p>
      {a.role && (
        <details className="card p-4"><summary className="cursor-pointer font-semibold">Add a question</summary>
          <ActionForm action={addQuestion.bind(null, id)} resetOnSuccess className="mt-4 grid gap-3 sm:grid-cols-2">
            <div><label htmlFor="subject" className="label">Subject</label><select id="subject" name="subject" className="input"><option value="">No specific subject</option>{subjects?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
            <div><label htmlFor="type" className="label">Type</label><select id="type" name="type" className="input"><option value="practice">Practice Question</option><option value="previous_exam">Previous Exam Question</option></select></div>
            <div className="sm:col-span-2"><label htmlFor="question" className="label">Question</label><textarea id="question" name="question" required minLength={5} maxLength={2000} rows={3} className="input" /></div>
            <div className="sm:col-span-2"><label htmlFor="answer" className="label">Answer (optional)</label><textarea id="answer" name="answer" maxLength={4000} rows={3} className="input" /></div>
            <div><label htmlFor="topic" className="label">Topic / unit</label><input id="topic" name="topic" maxLength={100} className="input" /></div>
            <div><label htmlFor="source" className="label">Source (e.g. 2080 board paper)</label><input id="source" name="source" maxLength={300} className="input" /></div>
            <div className="sm:col-span-2"><SubmitButton>Add question</SubmitButton></div>
          </ActionForm></details>)}
      <div className="flex flex-wrap items-end gap-3">
        <form className="flex flex-1 flex-wrap gap-3" role="search">
          <select name="subject" aria-label="Subject" defaultValue={sp.subject ?? ""} className="input max-w-xs"><option value="">All subjects</option>{subjects?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
          <select name="type" aria-label="Type" defaultValue={sp.type ?? ""} className="input max-w-xs"><option value="">All types</option>{Object.entries(QUESTION_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          <button className="btn-secondary">Filter</button></form>
        {savedSet.size > 0 && <Link className="btn-primary" href={`/pdf-maker?group=${id}&saved=1`}><FileDown className="h-4 w-4" aria-hidden />PDF from my saved ({savedSet.size})</Link>}
      </div>
      {!rows.length ? <EmptyState icon={BookMarked} title="No questions yet">Add important or practice questions for your subjects.</EmptyState> : (<>
        <ul className="space-y-3">{rows.map((r) => {
          const isSaved = savedSet.has(r.id);
          return (
            <li key={r.id} className="card p-4">
              <div className="flex flex-wrap gap-2"><span className={`badge ${r.question_type === "teacher_confirmed" ? "!bg-success/10 !text-success" : ""}`}>{r.question_type === "teacher_confirmed" && <BadgeCheck className="mr-1 h-3 w-3" aria-hidden />}{QUESTION_TYPES[r.question_type]}</span><span className="badge !bg-line !text-muted">{r.subjects?.name}</span>{r.topic && <span className="badge !bg-line !text-muted">{r.topic}</span>}</div>
              <p className="mt-2 whitespace-pre-line">{r.question_text}</p>
              {r.answer_text && <details className="mt-2"><summary className="cursor-pointer text-sm text-brand-700">Show answer</summary><p className="mt-1 whitespace-pre-line text-sm">{r.answer_text}</p></details>}
              <p className="mt-2 text-xs text-muted">{r.profiles?.display_name}{r.source_note && ` · Source: ${r.source_note}`}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <ActionForm action={async () => { "use server"; return toggleSaved(id, r.id, isSaved); }}><SubmitButton variant="secondary">{isSaved ? <BookmarkCheck className="h-4 w-4" aria-hidden /> : <Bookmark className="h-4 w-4" aria-hidden />}{isSaved ? "Saved" : "Save"}</SubmitButton></ActionForm>
                <Link className="btn-ghost" href={`/report-content?type=question&id=${r.id}`}>Report</Link>
                {a.isAdmin && r.question_type !== "teacher_confirmed" && <ActionForm action={async () => { "use server"; return confirmQuestion(id, r.id); }} confirm="Mark as teacher-confirmed? Only do this after verification."><SubmitButton variant="secondary">Confirm</SubmitButton></ActionForm>}
                {(r.created_by === a.user.id || a.canModerate) && <ActionForm action={async () => { "use server"; return deleteQuestion(id, r.id); }} confirm="Delete this question?"><SubmitButton variant="ghost"><Trash2 className="h-4 w-4" aria-hidden />Delete</SubmitButton></ActionForm>}
              </div></li>);
        })}</ul><Pagination page={page} hasNext={(data?.length ?? 0) > PAGE} base={base} /></>)}
    </div>);
}
