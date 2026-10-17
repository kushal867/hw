import Link from "next/link";
import { Lock } from "lucide-react";
import { SemesterTabs } from "@/components/semester-tabs";
import { PageHeader } from "@/components/ui/misc";
import { loadSemester, semesterAccess } from "@/lib/semester";

export default async function SemesterLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sem = await loadSemester(id);
  const a = await semesterAccess(id);
  const title = `${sem.courses.name} · Semester ${sem.semester_number}`;
  if (!a.canRead) {
    // Non-members learn nothing beyond the public hierarchy label.
    return (
      <div className="card mx-auto mt-10 max-w-md p-8 text-center">
        <Lock className="mx-auto mb-3 h-6 w-6 text-brand-600" aria-hidden />
        <h1 className="text-lg font-bold">{title}</h1><p className="text-sm text-muted">{sem.courses.colleges.name}</p>
        <p className="mt-4 text-sm">This semester is private. Ask your class owner for an invitation link or QR code.</p>
        <Link href="/my-semesters" className="btn-primary mt-5">Join with an invitation</Link>
      </div>);
  }
  return (<>
    <PageHeader title={title} sub={`${sem.courses.colleges.name}${sem.academic_year ? ` · ${sem.academic_year}` : ""}`} />
    <SemesterTabs id={id} canModerate={a.canModerate} />
    <div className="mt-6">{children}</div>
  </>);
}
