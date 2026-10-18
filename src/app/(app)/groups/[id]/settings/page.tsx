import { notFound } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { InviteManager } from "@/components/invite-manager";
import { groupAccess, loadGroup } from "@/lib/group";
import { createClient } from "@/lib/server-db";
import { formatDate } from "@/lib/format";
import { deleteGroup, revokeInvite, updateGroup } from "@/app/actions/groups";

export const metadata = { title: "Manage group" };

export default async function Settings({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await groupAccess(id);
  if (!a.canModerate) notFound();   // owners, moderators, platform admins only (RLS enforces the same on invites)
  const group = await loadGroup(id);
  if (!group) notFound();
  const { data: invites } = await (await createClient()).from("group_invites")
    .select("id,expires_at,max_uses,used_count,revoked_at,requires_approval,created_at").eq("group_id", id).order("created_at", { ascending: false }).limit(20);
  const status = (i: any) => i.revoked_at ? "Revoked" : new Date(i.expires_at) <= new Date() ? "Expired" : i.max_uses && i.used_count >= i.max_uses ? "Used up" : "Active";
  return (
    <div className="space-y-8">
      {a.isOwner && (
        <section className="card p-5"><h2 className="mb-3 font-semibold">Group settings</h2>
          <ActionForm action={updateGroup.bind(null, id)} className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2"><label htmlFor="name" className="label">Name</label><input id="name" name="name" defaultValue={group.name} required minLength={3} maxLength={80} className="input" /></div>
            <div className="sm:col-span-2"><label htmlFor="description" className="label">Description</label><textarea id="description" name="description" defaultValue={group.description ?? ""} rows={3} maxLength={500} className="input" /></div>
            <div><label htmlFor="visibility" className="label">Visibility</label><select id="visibility" name="visibility" defaultValue={group.visibility} className="input"><option value="public">Public (listed in Find Groups)</option><option value="private">Private (invitation only)</option></select></div>
            <div><label htmlFor="join_policy" className="label">Public join policy</label><select id="join_policy" name="join_policy" defaultValue={group.join_policy === "open" ? "open" : "approval"} className="input"><option value="approval">Requests need approval</option><option value="open">Anyone can join instantly</option></select></div>
            <div className="sm:col-span-2"><SubmitButton>Save settings</SubmitButton></div>
          </ActionForm></section>)}
      <section className="card p-5"><h2 className="mb-1 font-semibold">Create invitation</h2>
        <p className="mb-4 text-sm text-muted">Anyone with the link can join (or request to join) until it expires or is revoked. Works for private groups too.</p><InviteManager groupId={id} /></section>
      <section aria-labelledby="inv"><h2 id="inv" className="mb-3 font-semibold">Invitations</h2>
        {!invites?.length ? <p className="text-sm text-muted">No invitations yet.</p> : (
          <ul className="space-y-2">{invites.map((i) => (
            <li key={i.id} className="card flex flex-wrap items-center gap-3 p-3 text-sm">
              <span className={`badge ${status(i) === "Active" ? "" : "!bg-line !text-muted"}`}>{status(i)}</span>
              <span>Expires {formatDate(i.expires_at, true)}</span><span className="text-muted">{i.used_count}{i.max_uses ? ` / ${i.max_uses}` : ""} uses{i.requires_approval ? " · approval required" : ""}</span>
              {status(i) === "Active" && <div className="ml-auto"><ActionForm action={async () => { "use server"; return revokeInvite(id, i.id); }} confirm="Revoke this invitation? The link and QR code will stop working."><SubmitButton variant="danger">Revoke</SubmitButton></ActionForm></div>}
            </li>))}</ul>)}</section>
      {a.isOwner && (
        <section className="card border-danger/30 p-5"><h2 className="mb-1 font-semibold text-danger">Delete group</h2>
          <p className="mb-3 text-sm text-muted">Permanently deletes the group, its files, discussions and questions. This can&apos;t be undone.</p>
          <ActionForm action={deleteGroup.bind(null, id)} confirm="Delete this group and everything in it permanently?" className="flex flex-wrap gap-2">
            <label htmlFor="confirm" className="sr-only">Type the group name to confirm</label>
            <input id="confirm" name="confirm" required placeholder={`Type "${group.name}" to confirm`} className="input max-w-sm" /><SubmitButton variant="danger">Delete group</SubmitButton></ActionForm></section>)}
    </div>);
}
