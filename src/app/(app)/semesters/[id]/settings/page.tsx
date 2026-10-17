import { notFound } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { InviteManager } from "@/components/invite-manager";
import { semesterAccess } from "@/lib/semester";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import { revokeInvite } from "@/app/actions/semesters";

export const metadata = { title: "Invitations" };

export default async function Settings({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await semesterAccess(id);
  if (!a.canModerate) notFound();   // owners, moderators, platform admins only (RLS enforces the same on invites)
  const { data: invites } = await (await createClient()).from("semester_invites")
    .select("id,expires_at,max_uses,used_count,revoked_at,requires_approval,created_at").eq("semester_id", id).order("created_at", { ascending: false }).limit(20);
  const status = (i: any) => i.revoked_at ? "Revoked" : new Date(i.expires_at) <= new Date() ? "Expired" : i.max_uses && i.used_count >= i.max_uses ? "Used up" : "Active";
  return (
    <div className="space-y-8">
      <section className="card p-5"><h2 className="mb-1 font-semibold">Create invitation</h2>
        <p className="mb-4 text-sm text-muted">Anyone with the link can request to join until it expires or is revoked.</p><InviteManager semesterId={id} /></section>
      <section aria-labelledby="inv"><h2 id="inv" className="mb-3 font-semibold">Invitations</h2>
        {!invites?.length ? <p className="text-sm text-muted">No invitations yet.</p> : (
          <ul className="space-y-2">{invites.map((i) => (
            <li key={i.id} className="card flex flex-wrap items-center gap-3 p-3 text-sm">
              <span className={`badge ${status(i) === "Active" ? "" : "!bg-line !text-muted"}`}>{status(i)}</span>
              <span>Expires {formatDate(i.expires_at, true)}</span><span className="text-muted">{i.used_count}{i.max_uses ? ` / ${i.max_uses}` : ""} uses{i.requires_approval ? " · approval required" : ""}</span>
              {status(i) === "Active" && <div className="ml-auto"><ActionForm action={async () => { "use server"; return revokeInvite(id, i.id); }} confirm="Revoke this invitation? The link and QR code will stop working."><SubmitButton variant="danger">Revoke</SubmitButton></ActionForm></div>}
            </li>))}</ul>)}</section>
    </div>);
}
