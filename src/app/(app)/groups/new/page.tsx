import { AcademicPicker } from "@/components/academic-picker";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
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
      <ActionForm action={createGroup} className="card max-w-2xl space-y-4 p-5">
        <div><label htmlFor="name" className="label">Group name</label><input id="name" name="name" required minLength={3} maxLength={80} className="input" placeholder="e.g. BIT Sem 3 homework sharing" /></div>
        <div><label htmlFor="description" className="label">What is this group for? (optional)</label><textarea id="description" name="description" rows={3} maxLength={500} className="input" /></div>
        <fieldset><legend className="label">Who can find this group?</legend>
          <label className="flex items-start gap-2 text-sm"><input type="radio" name="visibility" value="public" defaultChecked className="mt-1" /><span><strong>Public</strong> — shown in Find Groups. Files and discussions stay visible to members only.</span></label>
          <label className="mt-2 flex items-start gap-2 text-sm"><input type="radio" name="visibility" value="private" className="mt-1" /><span><strong>Private</strong> — hidden. People join only with your invitation link or QR code.</span></label></fieldset>
        <div><label htmlFor="join_policy" className="label">How do people join a public group?</label>
          <select id="join_policy" name="join_policy" defaultValue="approval" className="input"><option value="approval">They request, and I approve</option><option value="open">Anyone can join instantly</option></select>
          <p className="mt-1 text-xs text-muted">Ignored for private groups (invitation only).</p></div>
        <fieldset><legend className="label">Link to a college (optional)</legend>
          <div className="grid gap-3 sm:grid-cols-3">
            <AcademicPicker colleges={colleges.data ?? []} courses={courses.data ?? []} semesters={semesters.data ?? []} names={{ college: "link_college", course: "link_course", semester: "semester" }} /></div>
          <p className="mt-1 text-xs text-muted">Linking lets classmates find you by college and lets you tag files with that term&apos;s subjects.</p></fieldset>
        <SubmitButton>Create group</SubmitButton>
      </ActionForm>
    </>);
}
