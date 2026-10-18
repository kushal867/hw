import { PdfMaker } from "@/components/pdf-maker";
import { PageHeader } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "PDF Maker" };

export default async function PdfMakerPage({ searchParams }: { searchParams: Promise<{ group?: string; saved?: string }> }) {
  const sp = await searchParams;
  const { profile } = await requireUser();
  const supabase = await createClient();
  const [{ data: mems }, { data: saved }] = await Promise.all([
    supabase.from("group_members").select("groups(id,name)").eq("user_id", profile.id).eq("membership_status", "active"),
    supabase.from("saved_questions").select("exam_questions(id,question_text,subjects(name))").eq("user_id", profile.id).order("created_at", { ascending: false }).limit(200),
  ]);
  const semesters = (mems ?? []).map((m: any) => ({ id: m.groups.id, label: m.groups.name }));
  const questions = (saved ?? []).map((s: any) => s.exam_questions).filter(Boolean).map((q: any) => ({ id: q.id, text: q.question_text, subject: q.subjects?.name ?? "" }));
  return (<><PageHeader title="PDF Maker" sub="Write notes or question sets and export a clean, printable PDF. Nepali (Unicode) text is supported." />
    <PdfMaker saved={questions} semesters={semesters} defaultSemester={sp.group} prefill={sp.saved === "1"} /></>);
}
