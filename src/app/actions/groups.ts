"use server";
import { revalidatePath } from "next/cache";
import QRCode from "qrcode";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { allow, audit, hashToken, newInviteToken } from "@/lib/security";
import { authorize, isUuid, notify } from "@/lib/group";
import { env } from "@/lib/env";
import type { ActionResult } from "@/components/ui/action-form";

// ───────── Creating and managing groups (any student can create one) ─────────
const GroupInput = z.object({
  name: z.string().trim().min(3, "Group name must be at least 3 characters.").max(80, "Group name is limited to 80 characters."),
  description: z.string().trim().max(500, "Description is limited to 500 characters."),
  visibility: z.enum(["public", "private"], { message: "Choose public or private." }),
  join_policy: z.enum(["open", "approval"]).default("approval"),
  semester: z.string().refine((s) => s === "" || isUuid(s), "Invalid semester."),
});

export async function createGroup(fd: FormData): Promise<ActionResult> {
  const { user, profile } = await requireUser();
  if (profile.restricted_until && new Date(profile.restricted_until) > new Date()) return { ok: false, message: "Your account is currently restricted." };
  const p = GroupInput.safeParse({ name: fd.get("name"), description: fd.get("description") ?? "", visibility: fd.get("visibility"), join_policy: fd.get("join_policy") ?? "approval", semester: fd.get("semester") ?? "" });
  if (!p.success) return { ok: false, message: p.error.issues[0].message };
  if (!(await allow(user.id, "group.create", 5, 86400))) return { ok: false, message: "You can create up to 5 groups per day. Try again tomorrow." };
  const { data, error } = await createAdminClient().rpc("create_group", {
    p_user: user.id, p_name: p.data.name, p_desc: p.data.description, p_semester: p.data.semester || null, p_visibility: p.data.visibility, p_policy: p.data.join_policy,
  });
  if (error) return { ok: false, message: error.message.includes("limit") ? "You already own the maximum number of groups (20)." : "Could not create the group." };
  return { ok: true, message: "Group created. Invite your classmates!", redirect: `/groups/${data}` };
}

/** Owner edits name/description/visibility/join policy through RLS + column grants (members can't). */
export async function updateGroup(groupId: string, fd: FormData): Promise<ActionResult> {
  const auth = await authorize(groupId, "owner");
  if (!auth.ok) return auth.result;
  const p = GroupInput.omit({ semester: true }).safeParse({ name: fd.get("name"), description: fd.get("description") ?? "", visibility: fd.get("visibility"), join_policy: fd.get("join_policy") ?? "approval" });
  if (!p.success) return { ok: false, message: p.error.issues[0].message };
  const policy = p.data.visibility === "private" ? "invite_only" : p.data.join_policy;
  const { data, error } = await createAdminClient().from("groups").update({ name: p.data.name, description: p.data.description || null, visibility: p.data.visibility, join_policy: policy }).eq("id", groupId).select("id");
  if (error || !data?.length) return { ok: false, message: "Could not save the group." };
  await audit(auth.userId, "group.update", "group", groupId);
  revalidatePath(`/groups/${groupId}`);
  return { ok: true, message: "Group updated." };
}

/** Owner deletes the group and everything in it, including stored files. */
export async function deleteGroup(groupId: string, fd: FormData): Promise<ActionResult> {
  const auth = await authorize(groupId, "owner");
  if (!auth.ok) return auth.result;
  const db = createAdminClient();
  const { data: g } = await db.from("groups").select("name").eq("id", groupId).maybeSingle();
  if (!g || String(fd.get("confirm") ?? "").trim() !== g.name) return { ok: false, message: "Type the group name exactly to confirm." };
  const { data: files } = await db.from("documents").select("storage_path").eq("group_id", groupId);
  if (files?.length) await db.storage.from("documents").remove(files.map((f) => f.storage_path));
  const { error } = await db.from("groups").delete().eq("id", groupId);
  if (error) return { ok: false, message: "Could not delete the group." };
  await audit(auth.userId, "group.delete", "group", groupId, { name: g.name });
  return { ok: true, message: "Group deleted.", redirect: "/my-groups" };
}

// ───────── Joining ─────────
/** Join (open) or request to join (approval) a PUBLIC group. Private/invite-only groups need an invitation. */
export async function joinGroup(groupId: string): Promise<ActionResult> {
  const { user } = await requireUser();
  if (!isUuid(groupId)) return { ok: false, message: "Invalid group." };
  if (!(await allow(user.id, "group.join", 20, 3600))) return { ok: false, message: "Too many join attempts. Try again later." };
  const { data, error } = await createAdminClient().rpc("join_group", { p_user: user.id, p_group: groupId });
  if (error) return { ok: false, message: "Something went wrong. Please try again." };
  const r = data as { status: string };
  switch (r.status) {
    case "joined": return { ok: true, message: "You've joined the group!", redirect: `/groups/${groupId}` };
    case "already_member": return { ok: true, message: "You're already a member.", redirect: `/groups/${groupId}` };
    case "pending": {
      const { data: owners } = await createAdminClient().from("group_members").select("user_id").eq("group_id", groupId).in("role", ["owner", "moderator"]).eq("membership_status", "active");
      await Promise.all((owners ?? []).map((o) => notify(o.user_id, "join_request", "New join request", `/groups/${groupId}/members`)));
      return { ok: true, message: "Request sent. A group moderator will review it.", redirect: `/groups/${groupId}` };
    }
    case "restricted": return { ok: false, message: "Your account is currently restricted." };
    case "blocked": return { ok: false, message: "You can't rejoin this group. Contact a moderator." };
    default: return { ok: false, message: "This group needs an invitation to join." };
  }
}

export async function createInvite(groupId: string, fd: FormData): Promise<ActionResult> {
  const auth = await authorize(groupId, "moderator");
  if (!auth.ok) return auth.result;
  const p = z.object({
    hours: z.coerce.number().int().min(1).max(24 * 90),
    maxUses: z.union([z.literal(""), z.coerce.number().int().min(1).max(1000)]),
  }).safeParse({ hours: fd.get("hours"), maxUses: fd.get("maxUses") ?? "" });
  if (!p.success) return { ok: false, message: "Check the expiry (1 hour – 90 days) and maximum uses (1 – 1000)." };
  if (!(await allow(auth.userId, "invite.create", 20, 3600))) return { ok: false, message: "Too many invitations created. Try again later." };

  const token = newInviteToken();                       // 256 bits of CSPRNG output
  const { error } = await createAdminClient().from("group_invites").insert({
    group_id: groupId, token_hash: hashToken(token), created_by: auth.userId,
    requires_approval: fd.get("approval") === "on",
    expires_at: new Date(Date.now() + p.data.hours * 3600_000).toISOString(),
    max_uses: p.data.maxUses === "" ? null : p.data.maxUses,
  });
  if (error) return { ok: false, message: "Could not create the invitation." };
  const url = `${env.siteUrl}/join/${token}`;           // the raw token is shown once and never stored
  const qr = await QRCode.toDataURL(url, { width: 320, margin: 2, errorCorrectionLevel: "M" }); // encodes only the join URL
  revalidatePath(`/groups/${groupId}/settings`);
  return { ok: true, message: "Invitation created. Copy the link now — it can't be shown again.", data: { url, qr } };
}

export async function revokeInvite(groupId: string, inviteId: string): Promise<ActionResult> {
  const auth = await authorize(groupId, "moderator");
  if (!auth.ok || !isUuid(inviteId)) return auth.ok ? { ok: false, message: "Invalid invitation." } : auth.result;
  await createAdminClient().from("group_invites").update({ revoked_at: new Date().toISOString() }).eq("id", inviteId).eq("group_id", groupId);
  revalidatePath(`/groups/${groupId}/settings`);
  return { ok: true, message: "Invitation revoked." };
}

/** Called from /join/[token]. Validation + counting happen atomically in the redeem_invite SQL function. */
export async function joinWithToken(token: string): Promise<ActionResult> {
  const { user } = await requireUser();
  if (!/^[\w-]{20,100}$/.test(token)) return { ok: false, message: "This invitation link is not valid." };
  if (!(await allow(user.id, "invite.redeem", 15, 600))) return { ok: false, message: "Too many attempts. Please wait a few minutes." };
  const { data, error } = await createAdminClient().rpc("redeem_invite", { p_token_hash: hashToken(token), p_user: user.id });
  if (error) return { ok: false, message: "Something went wrong. Please try again." };
  const r = data as { status: string; group_id?: string };
  switch (r.status) {
    case "joined": return { ok: true, message: "You've joined the group!", redirect: `/groups/${r.group_id}` };
    case "already_member": return { ok: true, message: "You're already a member.", redirect: `/groups/${r.group_id}` };
    case "pending": return { ok: true, message: "Request sent. A moderator will approve you shortly.", redirect: "/my-groups" };
    case "restricted": return { ok: false, message: "Your account is currently restricted." };
    case "blocked": return { ok: false, message: "You can't rejoin this group. Contact a moderator." };
    default: return { ok: false, message: "This invitation is expired, revoked, or has reached its limit." };
  }
}

// ───────── Members ─────────
export async function decideRequest(groupId: string, targetId: string, approve: boolean): Promise<ActionResult> {
  const auth = await authorize(groupId, "moderator");
  if (!auth.ok || !isUuid(targetId)) return auth.ok ? { ok: false, message: "Invalid request." } : auth.result;
  const { error } = await createAdminClient().rpc("decide_join_request", { p_actor: auth.userId, p_group: groupId, p_target: targetId, p_approve: approve });
  if (error) return { ok: false, message: "Not allowed." };
  await notify(targetId, "join", approve ? "Your join request was approved" : "Your join request was declined", approve ? `/groups/${groupId}` : "/my-groups");
  revalidatePath(`/groups/${groupId}/members`);
  return { ok: true, message: approve ? "Member approved." : "Request declined." };
}

export async function setRole(groupId: string, targetId: string, role: string): Promise<ActionResult> {
  const auth = await authorize(groupId, "owner");
  if (!auth.ok || !isUuid(targetId)) return auth.ok ? { ok: false, message: "Invalid request." } : auth.result;
  const { error } = await createAdminClient().rpc("set_member_role", { p_actor: auth.userId, p_group: groupId, p_target: targetId, p_role: role });
  if (error) return { ok: false, message: error.message.includes("forbidden") ? "Only the owner can change roles." : error.message };
  revalidatePath(`/groups/${groupId}/members`);
  return { ok: true, message: role === "owner" ? "Ownership transferred." : "Role updated." };
}

export async function removeMember(groupId: string, targetId: string): Promise<ActionResult> {
  const auth = await authorize(groupId, "moderator");
  if (!auth.ok || !isUuid(targetId)) return auth.ok ? { ok: false, message: "Invalid request." } : auth.result;
  const { error } = await createAdminClient().rpc("remove_member", { p_actor: auth.userId, p_group: groupId, p_target: targetId });
  if (error) return { ok: false, message: "You can't remove that member." };
  revalidatePath(`/groups/${groupId}/members`);
  return { ok: true, message: "Member removed." };
}

export async function leaveGroup(groupId: string): Promise<ActionResult> {
  const { user } = await requireUser();
  if (!isUuid(groupId)) return { ok: false, message: "Invalid group." };
  const { data } = await (await createClient()).from("group_members").delete().eq("group_id", groupId).eq("user_id", user.id).select();
  if (!data?.length) return { ok: false, message: "Owners must transfer ownership before leaving." };
  return { ok: true, message: "You left the group.", redirect: "/my-groups" };
}
