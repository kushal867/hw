import { AcademicPicker } from "@/components/academic-picker";
import { VisibilityFields } from "@/components/visibility-fields";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import Link from "next/link";
import { PageHeader } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/server-db";
import { createGroup } from "@/app/actions/groups";

export const metadata = { title: "Create group" };

export default async function NewGroup() {
  await requireUser();
  const supabase = await createClient();
  const [colleges, courses, semesters] = await Promise.all([
    supabase.from("colleges").select("id,name").order("name"),
    supabase.from("courses").select("id,name,college_id,term_label").order("name"),
    supabase.from("semesters").select("id,semester_number,academic_year,course_id").order("semester_number"),
  ]);
  return (
    <>
      <PageHeader title="Create a group" sub="Any student can start a group — for a class, homework sharing, or a study circle." />
      <ActionForm action={createGroup} className="card max-w-3xl space-y-6 p-6 sm:p-8">
        <div><label htmlFor="name" className="label">Group name</label><input id="name" name="name" required minLength={3} maxLength={80} className="input" placeholder="e.g. BIT Sem 3 homework sharing" /></div>
        <div><label htmlFor="description" className="label">What is this group for? (optional)</label><textarea id="description" name="description" rows={3} maxLength={500} className="input" /></div>
        <VisibilityFields />
        <fieldset><legend className="label">Link to a college <span className="font-normal text-muted">(optional)</span></legend>
          <div className="grid gap-3 md:grid-cols-3">
            <AcademicPicker colleges={colleges.data ?? []} courses={courses.data ?? []} semesters={semesters.data ?? []} names={{ college: "link_college", course: "link_course", semester: "semester" }} /></div>
          <p className="mt-1 text-xs text-muted">Linking lets classmates find you by college and lets you tag files with that term&apos;s subjects.</p></fieldset>
        <div className="flex items-center gap-3 border-t border-line pt-6"><SubmitButton className="btn-lg">Create group</SubmitButton><Link href="/my-groups" className="btn-ghost btn-lg">Cancel</Link></div>
      </ActionForm>
    </>);
}
