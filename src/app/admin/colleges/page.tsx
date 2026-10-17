import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { PageHeader } from "@/components/ui/misc";
import { createAdminClient } from "@/lib/db";
import { addCollege, addCourse, addSemester, addSubject, archiveRecord, assignOwner } from "@/app/actions/admin";

export const metadata = { title: "Colleges & courses" };

export default async function Colleges() {
  const db = createAdminClient();
  const [{ data: colleges }, { data: courses }, { data: sems }, { data: reqs }] = await Promise.all([
    db.from("colleges").select("id,name,city,status").order("name"),
    db.from("courses").select("id,name,status,college_id,colleges(name)").order("name"),
    db.from("semesters").select("id,semester_number,academic_year,status,courses(name,colleges(name)),subjects(id,name,status)").order("semester_number").limit(500),
    db.from("semester_requests").select("id,requester_id,semester_id,note,profiles(display_name),semesters(semester_number,courses(name))").eq("status", "open").limit(50),
  ]);
  const Sel = ({ name, items, label }: { name: string; label: string; items: { id: string; label: string }[] }) => (
    <div><label htmlFor={name} className="label">{label}</label><select id={name} name={name} required className="input"><option value="">Choose…</option>{items.map((i) => <option key={i.id} value={i.id}>{i.label}</option>)}</select></div>);
  const semItems = (sems ?? []).map((s: any) => ({ id: s.id, label: `${s.courses?.colleges?.name} — ${s.courses?.name} S${s.semester_number}${s.academic_year ? ` (${s.academic_year})` : ""}` }));
  return (<>
    <PageHeader title="Colleges, courses, semesters & subjects" />
    <div className="grid gap-6 lg:grid-cols-2">
      <ActionForm action={addCollege} resetOnSuccess className="card space-y-3 p-4"><h2 className="font-semibold">Add college</h2>
        <div><label htmlFor="name" className="label">Name</label><input id="name" name="name" required className="input" /></div><div><label htmlFor="city" className="label">City</label><input id="city" name="city" className="input" /></div><SubmitButton>Add college</SubmitButton></ActionForm>
      <ActionForm action={addCourse} resetOnSuccess className="card space-y-3 p-4"><h2 className="font-semibold">Add course</h2>
        <Sel name="college" label="College" items={(colleges ?? []).map((c) => ({ id: c.id, label: c.name }))} /><div><label htmlFor="cname" className="label">Course (e.g. BIT)</label><input id="cname" name="name" required className="input" /></div><div><label htmlFor="level" className="label">Degree level</label><input id="level" name="level" placeholder="Bachelor" className="input" /></div><SubmitButton>Add course</SubmitButton></ActionForm>
      <ActionForm action={addSemester} resetOnSuccess className="card space-y-3 p-4"><h2 className="font-semibold">Add semester</h2>
        <Sel name="course" label="Course" items={(courses ?? []).map((c: any) => ({ id: c.id, label: `${c.colleges?.name} — ${c.name}` }))} /><div><label htmlFor="number" className="label">Semester number</label><input id="number" name="number" type="number" min={1} max={12} required className="input" /></div><div><label htmlFor="year" className="label">Academic year / batch</label><input id="year" name="year" placeholder="2082" className="input" /></div><SubmitButton>Add semester</SubmitButton></ActionForm>
      <ActionForm action={addSubject} resetOnSuccess className="card space-y-3 p-4"><h2 className="font-semibold">Add subject</h2>
        <Sel name="semester" label="Semester" items={semItems} /><div><label htmlFor="sname" className="label">Subject name</label><input id="sname" name="name" required className="input" /></div><div><label htmlFor="code" className="label">Code</label><input id="code" name="code" className="input" /></div><SubmitButton>Add subject</SubmitButton></ActionForm>
    </div>
    <section className="mt-8"><h2 className="mb-3 font-semibold">Group requests</h2>
      {!reqs?.length ? <p className="text-sm text-muted">No open requests.</p> : <ul className="space-y-2">{reqs.map((r: any) => (
        <li key={r.id} className="card flex flex-wrap items-center gap-3 p-3 text-sm"><span><strong>{r.profiles?.display_name}</strong> wants {r.semesters?.courses?.name} S{r.semesters?.semester_number}{r.note && ` — “${r.note}”`}</span>
          <div className="ml-auto"><ActionForm action={async () => { "use server"; return assignOwner(r.semester_id, r.requester_id); }} confirm="Make this student the owner of the group?"><SubmitButton>Approve as owner</SubmitButton></ActionForm></div></li>))}</ul>}</section>
    <section className="mt-8"><h2 className="mb-3 font-semibold">Existing records</h2>
      <ul className="space-y-3">{(colleges ?? []).map((c) => (
        <li key={c.id} className="card p-4"><div className="flex items-center gap-2"><span className="font-semibold">{c.name}</span><span className="text-sm text-muted">{c.city}</span><span className="badge">{c.status}</span>
          <div className="ml-auto"><ActionForm action={async () => { "use server"; return archiveRecord("colleges", c.id, c.status === "active" ? "archived" : "active"); }}><SubmitButton variant="ghost">{c.status === "active" ? "Archive" : "Restore"}</SubmitButton></ActionForm></div></div>
          <ul className="mt-2 space-y-1 pl-4 text-sm">{(courses ?? []).filter((x) => x.college_id === c.id).map((co) => <li key={co.id}>{co.name} <span className="text-xs text-muted">({(sems ?? []).filter((s: any) => s.courses?.name === co.name && s.courses?.colleges?.name === c.name).length} semesters)</span></li>)}</ul></li>))}</ul></section>
  </>);
}
