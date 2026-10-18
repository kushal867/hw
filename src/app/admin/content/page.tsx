import { FileCheck } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { createAdminClient } from "@/lib/db";
import { CATEGORIES, formatBytes, formatDate, termName } from "@/lib/format";
import { reviewDocument } from "@/app/actions/admin";

export const metadata = { title: "Review queue" };

export default async function Content() {
  const { data } = await createAdminClient().from("documents").select("id,title,description,category,size_bytes,created_at,profiles(display_name),groups(name,semesters(semester_number,courses(name,term_label,colleges(name))))")
    .eq("moderation_status", "pending").order("created_at").limit(50);
  return (<>
    <PageHeader title="Public publication queue" sub="Review the PDF before approving. Approved files become visible to everyone." />
    {!data?.length ? <EmptyState icon={FileCheck} title="Nothing waiting for review" /> : (
      <ul className="space-y-3">{data.map((d: any) => (
        <li key={d.id} className="card p-4"><div className="flex flex-wrap gap-2"><h2 className="font-semibold">{d.title}</h2><span className="badge">{CATEGORIES[d.category]}</span></div>
          {d.description && <p className="mt-1 text-sm text-muted">{d.description}</p>}
          <p className="mt-1 text-xs text-muted">{d.profiles?.display_name} · {d.groups?.name}{d.groups?.semesters ? ` (${d.groups.semesters.courses?.colleges?.name} · ${d.groups.semesters.courses?.name} ${termName(d.groups.semesters.courses?.term_label, d.groups.semesters.semester_number)})` : ""} · {formatBytes(d.size_bytes)} · {formatDate(d.created_at)}</p>
          <div className="mt-3 flex flex-wrap gap-2"><a className="btn-secondary" href={`/api/documents/${d.id}/file`} target="_blank" rel="noopener">Open PDF</a>
            <ActionForm action={async () => { "use server"; return reviewDocument(d.id, true); }}><SubmitButton>Approve &amp; publish</SubmitButton></ActionForm>
            <ActionForm action={async () => { "use server"; return reviewDocument(d.id, false); }}><SubmitButton variant="secondary">Reject</SubmitButton></ActionForm></div></li>))}</ul>)}
  </>);
}
