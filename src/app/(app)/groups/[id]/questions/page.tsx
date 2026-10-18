import Link from "next/link";
import { BadgeCheck, Bookmark, BookmarkCheck, BookMarked, FileDown, Flag, Info, Plus, Trash2 } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { EmptyState, IconTile, Pagination } from "@/components/ui/misc";
import { groupAccess, loadGroup } from "@/lib/group";
import { createClient } from "@/lib/server-db";
import { QUESTION_TYPES, timeAgo } from "@/lib/format";
import { addQuestion, confirmQuestion, deleteQuestion, toggleSaved } from "@/app/actions/community";

export const metadata = { title: "Exam questions" };
const PAGE = 15;
const TYPE_TONE: Record<string, string> = { practice: "bg-indigo-50 text-indigo-700", previous_exam: "bg-amber-50 text-amber-700", teacher_confirmed: "bg-emerald-50 text-emerald-700" };

export default async function Questions({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { id } = await params; const sp = await searchParams;
  const a = await groupAccess(id);
  const page = Math.max(1, Number(sp.page) || 1);
  const supabase = await createClient();
  const group = await loadGroup(id);
  const { data: subjects } = group?.semester_id ? await supabase.from("subjects").select("id,name").eq("semester_id", group.semester_id).order("name") : { data: [] as { id: string; name: string }[] };
  let q = supabase.from("exam_questions").select("id,question_text,answer_text,topic,question_type,source_note,created_by,created_at,subjects(name),profiles(display_name,avatar_path)").eq("group_id", id).eq("status", "visible").order("created_at", { ascending: false });
  if (sp.subject) q = q.eq("subject_id", sp.subject);
  if (sp.type && QUESTION_TYPES[sp.type]) q = q.eq("question_type", sp.type);
  const { data } = await q.range((page - 1) * PAGE, page * PAGE);
  const rows = (data ?? []).slice(0, PAGE) as any[];
  const { data: saved } = await supabase.from("saved_questions").select("question_id").eq("user_id", a.user.id);
  const savedSet = new Set(saved?.map((s) => s.question_id));
  const base = `/groups/${id}/questions?` + new URLSearchParams(Object.entries(sp).filter(([k, v]) => v && k !== "page") as [string, string][]).toString();
  const hasFilters = !!(sp.subject || sp.type);

  return (
    <div className="space-y-5">
      <p className="flex items-start gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/70 p-4 text-sm leading-relaxed text-indigo-900"><Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /><span>Questions here are student-contributed study aids. They are <strong>not</strong> guaranteed to appear in any exam. Only questions labelled &ldquo;Teacher-Confirmed&rdquo; have passed verification.</span></p>

      {a.role && (
        <details className="card group overflow-hidden" open={!rows.length && !hasFilters}>
          <summary className="flex cursor-pointer list-none items-center gap-3 p-4 [&::-webkit-details-marker]:hidden">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-50 text-amber-600"><Plus className="h-5 w-5 transition group-open:rotate-45" aria-hidden /></span>
            <span><span className="block font-bold">Add a question</span><span className="block text-xs text-muted">Practice or previous-exam questions, with an optional answer.</span></span>
          </summary>
          <ActionForm action={addQuestion.bind(null, id)} resetOnSuccess className="grid gap-4 border-t border-line p-5 sm:grid-cols-2">
            {!!subjects?.length && <div><label htmlFor="subject" className="label">Subject</label><select id="subject" name="subject" className="input"><option value="">No specific subject</option>{subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>}
            <div><label htmlFor="type" className="label">Type</label><select id="type" name="type" className="input"><option value="practice">Practice Question</option><option value="previous_exam">Previous Exam Question</option></select></div>
            <div className="sm:col-span-2"><label htmlFor="question" className="label">Question</label><textarea id="question" name="question" required minLength={5} maxLength={2000} rows={3} className="input" /></div>
            <div className="sm:col-span-2"><label htmlFor="answer" className="label">Answer <span className="font-normal text-muted">(optional)</span></label><textarea id="answer" name="answer" maxLength={4000} rows={3} className="input" /></div>
            <div><label htmlFor="topic" className="label">Topic / unit</label><input id="topic" name="topic" maxLength={100} className="input" placeholder="e.g. Unit 3" /></div>
            <div><label htmlFor="source" className="label">Source</label><input id="source" name="source" maxLength={300} className="input" placeholder="e.g. 2080 board paper" /></div>
            <div className="sm:col-span-2"><SubmitButton className="btn-lg">Add question</SubmitButton></div>
          </ActionForm>
        </details>)}

      <div className="flex flex-wrap items-center gap-2">
        <form className="flex flex-1 flex-wrap gap-2" role="search">
          {!!subjects?.length && <select name="subject" aria-label="Subject" defaultValue={sp.subject ?? ""} className="input !w-auto"><option value="">All subjects</option>{subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>}
          <select name="type" aria-label="Type" defaultValue={sp.type ?? ""} className="input !w-auto"><option value="">All types</option>{Object.entries(QUESTION_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          <button className="btn-secondary">Filter</button>{hasFilters && <Link href={`/groups/${id}/questions`} className="btn-ghost">Clear</Link>}</form>
        {savedSet.size > 0 && <Link className="btn-primary" href={`/pdf-maker?group=${id}&saved=1`}><FileDown className="h-4 w-4" aria-hidden />PDF from my saved ({savedSet.size})</Link>}
      </div>

      {!rows.length ? <EmptyState icon={BookMarked} title={hasFilters ? "No questions match" : "No questions yet"}>{hasFilters ? "Try different filters." : "Add important or practice questions so everyone can revise from them."}</EmptyState> : (<>
        <ul className="space-y-3">{rows.map((r) => {
          const isSaved = savedSet.has(r.id);
          return (
            <li key={r.id} className="card p-4 sm:p-5">
              <div className="flex gap-4">
                <IconTile icon={BookMarked} tone="questions" size={44} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${TYPE_TONE[r.question_type]}`}>{r.question_type === "teacher_confirmed" && <BadgeCheck className="h-3.5 w-3.5" aria-hidden />}{QUESTION_TYPES[r.question_type]}</span>
                    {r.subjects?.name && <span className="badge-muted">{r.subjects.name}</span>}{r.topic && <span className="badge-muted">{r.topic}</span>}
                  </div>
                  <p className="mt-2.5 whitespace-pre-line text-[15px] font-semibold leading-relaxed">{r.question_text}</p>
                  {r.answer_text && <details className="group/ans mt-3 rounded-xl bg-slate-50 p-3"><summary className="cursor-pointer list-none text-sm font-semibold text-brand-700 [&::-webkit-details-marker]:hidden">Show answer</summary><p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-700">{r.answer_text}</p></details>}
                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line pt-3 text-xs text-muted">
                    <span className="flex items-center gap-2"><Avatar name={r.profiles?.display_name ?? "?"} path={r.profiles?.avatar_path} size={22} />{r.profiles?.display_name} · {timeAgo(r.created_at)}{r.source_note && ` · Source: ${r.source_note}`}</span>
                    <span className="ml-auto flex flex-wrap items-center gap-1">
                      <ActionForm action={async () => { "use server"; return toggleSaved(id, r.id, isSaved); }}><button className={`btn-ghost !min-h-[34px] !px-2.5 ${isSaved ? "!text-brand-700" : ""}`}>{isSaved ? <BookmarkCheck className="h-4 w-4" aria-hidden /> : <Bookmark className="h-4 w-4" aria-hidden />}{isSaved ? "Saved" : "Save"}</button></ActionForm>
                      {a.isAdmin && r.question_type !== "teacher_confirmed" && <ActionForm action={async () => { "use server"; return confirmQuestion(id, r.id); }} confirm="Mark as teacher-confirmed? Only do this after verification."><button className="btn-ghost !min-h-[34px] !px-2.5"><BadgeCheck className="h-4 w-4" aria-hidden />Confirm</button></ActionForm>}
                      <Link className="btn-ghost !min-h-[34px] !px-2.5" href={`/report-content?type=question&id=${r.id}`} aria-label="Report"><Flag className="h-4 w-4" aria-hidden /></Link>
                      {(r.created_by === a.user.id || a.canModerate) && <ActionForm action={async () => { "use server"; return deleteQuestion(id, r.id); }} confirm="Delete this question?"><button className="btn-ghost !min-h-[34px] !px-2.5 hover:!text-red-600" aria-label="Delete"><Trash2 className="h-4 w-4" aria-hidden /></button></ActionForm>}
                    </span>
                  </div>
                </div>
              </div></li>);
        })}</ul><Pagination page={page} hasNext={(data?.length ?? 0) > PAGE} base={base} /></>)}
    </div>);
}
