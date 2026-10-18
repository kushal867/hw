import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDate } from "@/lib/format";
import { setGroupStatus } from "@/app/actions/admin";
import { Users } from "lucide-react";

export const metadata = { title: "Groups" };

export default async function AdminGroups({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  let query = createAdminClient().from("groups").select("id,name,visibility,join_policy,status,created_at,profiles:created_by(display_name),group_members(count)").order("created_at", { ascending: false }).limit(50);
  if (q) query = query.ilike("name", `%${q.replace(/[%_\\]/g, "\\$&")}%`);
  const { data } = await query;
  return (<>
    <PageHeader title="Groups" sub="Archive abusive groups. Archived groups disappear from discovery and block new joins." />
    <form role="search" className="mb-4 flex max-w-md gap-2"><label htmlFor="q" className="sr-only">Search groups</label><input id="q" name="q" defaultValue={q} placeholder="Search by name" className="input" /><button className="btn-secondary">Search</button></form>
    {!data?.length ? <EmptyState icon={Users} title="No groups found" /> : (
      <ul className="space-y-2">{data.map((g: any) => (
        <li key={g.id} className="card flex flex-wrap items-center gap-3 p-3 text-sm">
          <Link href={`/groups/${g.id}`} className="font-medium hover:text-brand-700">{g.name}</Link>
          <span className="badge">{g.visibility}</span><span className="badge !bg-line !text-muted">{g.join_policy}</span>{g.status === "archived" && <span className="badge !bg-danger/10 !text-danger">archived</span>}
          <span className="text-xs text-muted">by {g.profiles?.display_name ?? "deleted user"} · {g.group_members?.[0]?.count ?? 0} members · {formatDate(g.created_at)}</span>
          <div className="ml-auto"><ActionForm action={async () => { "use server"; return setGroupStatus(g.id, g.status === "active" ? "archived" : "active"); }} confirm={g.status === "active" ? "Archive this group?" : "Restore this group?"}><SubmitButton variant={g.status === "active" ? "danger" : "secondary"}>{g.status === "active" ? "Archive" : "Restore"}</SubmitButton></ActionForm></div>
        </li>))}</ul>)}
  </>);
}
