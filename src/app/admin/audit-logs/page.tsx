import { PageHeader } from "@/components/ui/misc";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Audit & abuse" };

export default async function Audit() {
  const db = createAdminClient();
  const since = new Date(Date.now() - 86400_000).toISOString();
  const [{ data: logs }, { data: recent }] = await Promise.all([
    db.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(100),
    db.from("audit_logs").select("actor_id").eq("action", "document.upload").gte("created_at", since).limit(2000),
  ]);
  const counts = new Map<string, number>(); recent?.forEach((r) => r.actor_id && counts.set(r.actor_id, (counts.get(r.actor_id) ?? 0) + 1));
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  return (<>
    <PageHeader title="Audit history & abuse monitoring" />
    <section className="card mb-6 p-4"><h2 className="mb-2 font-semibold">Uploads in the last 24 hours</h2><p className="text-sm text-muted">{recent?.length ?? 0} uploads total.</p>
      {top.length > 0 && <ol className="mt-2 text-sm">{top.map(([id, n]) => <li key={id}><code>{id}</code> — {n} uploads</li>)}</ol>}</section>
    <div className="card overflow-x-auto"><table className="w-full text-left text-sm"><caption className="sr-only">Audit log</caption><thead className="border-b border-line text-xs text-muted"><tr><th className="p-3">When</th><th>Action</th><th>Target</th><th>Actor</th></tr></thead>
      <tbody>{logs?.map((l) => <tr key={l.id} className="border-b border-line/60"><td className="p-3 whitespace-nowrap">{formatDate(l.created_at, true)}</td><td>{l.action}</td><td className="max-w-[200px] truncate">{l.target_type} {l.target_id}</td><td className="max-w-[120px] truncate">{l.actor_id}</td></tr>)}</tbody></table>
      {!logs?.length && <p className="p-4 text-sm text-muted">No activity recorded yet.</p>}</div>
  </>);
}
