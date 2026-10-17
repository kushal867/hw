import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { PageHeader } from "@/components/ui/misc";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDate } from "@/lib/format";
import { completeDeletion, restrictUser } from "@/app/actions/admin";

export const metadata = { title: "Users" };

export default async function Users({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const db = createAdminClient();
  let query = db.from("profiles").select("id,display_name,username,platform_role,restricted_until,restriction_reason,created_at").order("created_at", { ascending: false }).limit(50);
  if (q) query = query.ilike("display_name", `%${q.replace(/[%_\\]/g, "\\$&")}%`);
  const [{ data: users }, { data: dels }] = await Promise.all([query, db.from("deletion_requests").select("id,user_id,created_at,profiles(display_name)").eq("status", "open")]);
  return (<>
    <PageHeader title="Users" />
    {!!dels?.length && <section className="card mb-6 border-warn/40 p-4"><h2 className="mb-2 font-semibold">Deletion requests</h2><ul className="space-y-2">{dels.map((d: any) => (
      <li key={d.id} className="flex items-center gap-3 text-sm"><span>{d.profiles?.display_name} · {formatDate(d.created_at)}</span><div className="ml-auto"><ActionForm action={async () => { "use server"; return completeDeletion(d.id); }} confirm="Permanently delete this account, uploads and posts?"><SubmitButton variant="danger">Delete data</SubmitButton></ActionForm></div></li>))}</ul></section>}
    <form role="search" className="mb-4 flex max-w-md gap-2"><label htmlFor="q" className="sr-only">Search users</label><input id="q" name="q" defaultValue={q} placeholder="Search by display name" className="input" /><button className="btn-secondary">Search</button></form>
    <ul className="space-y-2">{users?.map((u) => {
      const restricted = u.restricted_until && new Date(u.restricted_until) > new Date();
      return (<li key={u.id} className="card flex flex-wrap items-center gap-3 p-3 text-sm"><span className="font-medium">{u.display_name}</span>{u.username && <span className="text-muted">@{u.username}</span>}
        {u.platform_role === "admin" && <span className="badge">admin</span>}{restricted && <span className="badge !bg-danger/10 !text-danger">Restricted until {formatDate(u.restricted_until!)}</span>}
        <span className="text-xs text-muted">Joined {formatDate(u.created_at)}</span>
        {u.platform_role !== "admin" && <div className="ml-auto">{restricted
          ? <ActionForm action={async () => { "use server"; return restrictUser(u.id, 0, ""); }}><SubmitButton variant="secondary">Lift restriction</SubmitButton></ActionForm>
          : <ActionForm action={async (fd) => { "use server"; return restrictUser(u.id, Number(fd.get("days")), String(fd.get("reason") ?? "")); }} confirm="Restrict this user from posting and uploading?" className="flex gap-2">
              <select name="days" aria-label="Duration" className="input !w-auto"><option value="7">7 days</option><option value="30">30 days</option><option value="365">1 year</option></select><input name="reason" placeholder="Reason" required className="input !w-40" /><SubmitButton variant="danger">Restrict</SubmitButton></ActionForm>}</div>}
      </li>);
    })}</ul></>);
}
