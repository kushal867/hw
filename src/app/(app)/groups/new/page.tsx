import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { PageHeader } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createGroup } from "@/app/actions/groups";

export const metadata = { title: "Create group" };

export default async function NewGroup() {
  await requireUser();
  const { data } = await (await createClient()).from("semesters").select("id, semester_number, academic_year, courses(name, colleges(name))").limit(1000);
  // Group the optional "link to a semester" choices by college so the list stays easy to scan.
  const byCollege = new Map<string, { id: string; label: string }[]>();
  ((data ?? []) as any[]).forEach((s) => {
    const col = s.courses?.colleges?.name ?? "Other";
    byCollege.set(col, [...(byCollege.get(col) ?? []), { id: s.id, label: `${s.courses?.name} · Semester ${s.semester_number}${s.academic_year ? ` (${s.academic_year})` : ""}` }]);
  });
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
        <div><label htmlFor="semester" className="label">Link to a college semester (optional)</label>
          <select id="semester" name="semester" defaultValue="" className="input"><option value="">Not linked to a college</option>
            {[...byCollege.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([col, items]) => <optgroup key={col} label={col}>{items.map((i) => <option key={i.id} value={i.id}>{i.label}</option>)}</optgroup>)}</select>
          <p className="mt-1 text-xs text-muted">Linking lets classmates find you by college and lets you tag files with that semester&apos;s subjects.</p></div>
        <SubmitButton>Create group</SubmitButton>
      </ActionForm>
    </>);
}
