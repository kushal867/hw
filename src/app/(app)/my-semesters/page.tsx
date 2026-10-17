import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { JoinByLink } from "@/components/join-by-link";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { requestGroup } from "@/app/actions/semesters";

export const metadata = { title: "My Semesters" };

export default async function MySemesters() {
  const { profile } = await requireUser();
  const supabase = await createClient();
  const { data: mine } = await supabase.from("semester_members")
    .select("role, membership_status, semesters(id, semester_number, academic_year, courses(name, colleges(name)))").eq("user_id", profile.id);
  const { data: all } = await supabase.from("semesters").select("id, semester_number, academic_year, courses(name, colleges(name))").limit(500);
  const options = (all ?? []) as any[];
  return (
    <>
      <PageHeader title="My Semesters" sub="Your private classrooms." />
      <section className="card mb-6 p-5"><h2 className="mb-1 font-semibold">Join with an invitation</h2>
        <p className="mb-3 text-sm text-muted">Scan the QR code with your phone camera, or paste the link here.</p><JoinByLink /></section>
      {!mine?.length ? <EmptyState icon={GraduationCap} title="No semesters yet">Join with an invitation, or request that a group be set up for your semester.</EmptyState> : (
        <ul className="mb-8 grid gap-4 sm:grid-cols-2">{mine.map((m: any) => (
          <li key={m.semesters.id}>
            {m.membership_status === "active" ? (
              <Link href={`/semesters/${m.semesters.id}`} className="card block p-5 hover:border-brand-200">
                <p className="text-xs text-muted">{m.semesters.courses?.colleges?.name}</p>
                <p className="font-semibold">{m.semesters.courses?.name} · Semester {m.semesters.semester_number}</p><span className="badge mt-2 capitalize">{m.role}</span></Link>
            ) : (
              <div className="card p-5"><p className="font-semibold">{m.semesters.courses?.name} · Semester {m.semesters.semester_number}</p>
                <span className="badge mt-2">{m.membership_status === "pending" ? "Waiting for approval" : "Removed"}</span></div>)}
          </li>))}</ul>)}
      <section className="card p-5"><h2 className="mb-1 font-semibold">Request a group for your semester</h2>
        <p className="mb-3 text-sm text-muted">No group yet? Ask an administrator to set one up with you as the owner.</p>
        {!options.length ? <p className="text-sm text-muted">No semesters have been added yet.</p> : (
          <ActionForm action={async (fd) => { "use server"; return requestGroup(String(fd.get("semester")), fd); }} className="space-y-3">
            <label htmlFor="semester" className="label">Semester</label>
            <select id="semester" name="semester" className="input" required>{options.map((s) => <option key={s.id} value={s.id}>{s.courses?.colleges?.name} — {s.courses?.name}, Semester {s.semester_number}{s.academic_year ? ` (${s.academic_year})` : ""}</option>)}</select>
            <label htmlFor="note" className="label">Note (optional)</label>
            <textarea id="note" name="note" maxLength={500} rows={2} className="input" placeholder="E.g. I'm the class representative." />
            <SubmitButton>Send request</SubmitButton>
          </ActionForm>)}
      </section>
    </>
  );
}
