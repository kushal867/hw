import Link from "next/link";
import { Flag } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { createAdminClient } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { resolveReport } from "@/app/actions/admin";

export const metadata = { title: "Reports" };

export default async function Reports({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status = "open" } = await searchParams;
  const db = createAdminClient();
  const { data } = await db.from("reports").select("*, reporter:profiles!reports_reporter_id_fkey(display_name)").eq("status", ["open", "actioned", "dismissed"].includes(status) ? status : "open").order("created_at", { ascending: false }).limit(100);
  // Chat messages are private to their room; moderators see a message here ONLY because a participant reported it.
  const chatIds = (data ?? []).filter((r: any) => r.target_type === "chat_message").map((r: any) => r.target_id);
  const { data: chatRows } = chatIds.length ? await db.from("chat_messages").select("id,body,deleted_at,profiles!chat_messages_sender_id_fkey(display_name)").in("id", chatIds) : { data: [] as any[] };
  const chatById = new Map((chatRows ?? []).map((m: any) => [m.id, m]));
  return (<>
    <PageHeader title="Reports">{["open", "actioned", "dismissed"].map((s) => <Link key={s} href={`/admin/reports?status=${s}`} className={status === s ? "btn-primary" : "btn-secondary"}>{s}</Link>)}</PageHeader>
    {!data?.length ? <EmptyState icon={Flag} title={`No ${status} reports`} /> : (
      <ul className="space-y-3">{data.map((r: any) => (
        <li key={r.id} className="card p-4"><div className="flex flex-wrap gap-2"><span className="badge capitalize">{r.target_type}</span><span className="badge !bg-line !text-muted">{r.reason}</span></div>
          <p className="mt-2 text-sm">{r.details || <span className="text-muted">No details.</span>}</p>
          <p className="mt-1 text-xs text-muted">By {r.reporter?.display_name} · {formatDate(r.created_at, true)} · target <code>{r.target_id}</code></p>
          {r.target_type === "chat_message" && (() => { const m: any = chatById.get(r.target_id); return (
            <blockquote className="mt-2 rounded-xl border-l-4 border-amber-400 bg-amber-50 p-3 text-sm">
              {!m ? <span className="text-muted">Message no longer exists.</span> : m.deleted_at ? <span className="italic text-muted">Already deleted.</span> : <><p className="whitespace-pre-line break-words">{m.body}</p><p className="mt-1 text-xs text-muted">— {m.profiles?.display_name ?? "Unknown"} (shown to moderators because it was reported)</p></>}
            </blockquote>); })()}
          {r.target_type === "document" && <a className="mt-1 inline-block text-sm text-brand-700 underline" href={`/api/documents/${r.target_id}/file`} target="_blank">Open PDF</a>}
          {r.status === "open" && <div className="mt-3 flex flex-wrap gap-2">
            <ActionForm action={async () => { "use server"; return resolveReport(r.id, "actioned", true); }} confirm="Hide/remove the reported content?"><SubmitButton variant="danger">Remove content</SubmitButton></ActionForm>
            <ActionForm action={async () => { "use server"; return resolveReport(r.id, "actioned", false); }}><SubmitButton variant="secondary">Mark actioned</SubmitButton></ActionForm>
            <ActionForm action={async () => { "use server"; return resolveReport(r.id, "dismissed"); }}><SubmitButton variant="ghost">Dismiss</SubmitButton></ActionForm></div>}
        </li>))}</ul>)}
  </>);
}
