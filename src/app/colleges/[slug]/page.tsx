import Link from "next/link";
import { notFound } from "next/navigation";
import { GraduationCap } from "lucide-react";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { createClient } from "@/lib/server-db";

export default async function College({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: college } = await supabase.from("colleges").select("id,name,city").eq("slug", slug).maybeSingle();
  if (!college) notFound();
  const { data: courses } = await supabase.from("courses").select("id,name,degree_level,semesters(id,semester_number,academic_year)").eq("college_id", college.id).order("name");
  return (<><SiteHeader /><main id="main" className="mx-auto max-w-6xl px-4 py-10">
    <PageHeader title={college.name} sub={college.city ?? undefined} />
    {!courses?.length ? <EmptyState icon={GraduationCap} title="No courses yet">Courses for this college haven&apos;t been added.</EmptyState> : (
      <div className="space-y-6">{courses.map((c) => (
        <section key={c.id} className="card p-5" aria-labelledby={`c-${c.id}`}>
          <h2 id={`c-${c.id}`} className="font-semibold">{c.name} {c.degree_level && <span className="badge ml-2">{c.degree_level}</span>}</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {[...(c.semesters ?? [])].sort((a, b) => a.semester_number - b.semester_number).map((s) => (
              <li key={s.id}><Link href={`/semesters/${s.id}`} className="btn-secondary !min-h-[36px]">Semester {s.semester_number}{s.academic_year ? ` · ${s.academic_year}` : ""}</Link></li>))}
            {!c.semesters?.length && <li className="text-sm text-muted">No semesters yet.</li>}
          </ul>
        </section>))}</div>)}
    <p className="mt-6 text-sm text-muted">Semester workspaces are private: join with an invitation from your class to see files and discussions.</p>
  </main><SiteFooter /></>);
}
