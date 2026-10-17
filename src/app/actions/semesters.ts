"use server";
import { revalidatePath } from "next/cache";
import QRCode from "qrcode";
import { z } from "zod";
import { createAdminClient } from "@/lib/db";
import { createClient } from "@/lib/server-db";
import { requireUser } from "@/lib/auth";
import { allow, hashToken, newInviteToken } from "@/lib/security";
import { authorize, isUuid, notify } from "@/lib/semester";
import { env } from "@/lib/env";
import type { ActionResult } from "@/components/ui/action-form";

export async function createInvite(semesterId: string, fd: FormData): Promise<ActionResult> {
  const auth = await authorize(semesterId, "moderator");
  if (!auth.ok) return auth.result;
  const p = z.object({
    hours: z.coerce.number().int().min(1).max(24 * 90),
    maxUses: z.union([z.literal(""), z.coerce.number().int().min(1).max(1000)]),
  }).safeParse({ hours: fd.get("hours"), maxUses: fd.get("maxUses") ?? "" });
  if (!p.success) return { ok: false, message: "Check the expiry (1 hour – 90 days) and maximum uses (1 – 1000)." };
  if (!(await allow(auth.userId, "invite.create", 20, 3600))) return { ok: false, message: "Too many invitations created. Try again later." };

  const token = newInviteToken();                       // 256 bits of CSPRNG output
  const { error } = await createAdminClient().from("semester_invites").insert({
    semester_id: semesterId, token_hash: hashToken(token), created_by: auth.userId,
    requires_approval: fd.get("approval") === "on",
    expires_at: new Date(Date.now() + p.data.hours * 3600_000).toISOString(),
    max_uses: p.data.maxUses === "" ? null : p.data.maxUses,
  });
  if (error) return { ok: false, message: "Could not create the invitation." };
  const url = `${env.siteUrl}/join/${token}`;           // the raw token is shown once and never stored
  const qr = await QRCode.toDataURL(url, { width: 320, margin: 2, errorCorrectionLevel: "M" }); // encodes only the join URL
  revalidatePath(`/semesters/${semesterId}/settings`);
  return { ok: true, message: "Invitation created. Copy the link now — it can't be shown again.", data: { url, qr } };
}

export async function revokeInvite(semesterId: string, inviteId: string): Promise<ActionResult> {
  const auth = await authorize(semesterId, "moderator");
  if (!auth.ok || !isUuid(inviteId)) return auth.ok ? { ok: false, message: "Invalid invitation." } : auth.result;
  await createAdminClient().from("semester_invites").update({ revoked_at: new Date().toISOString() }).eq("id", inviteId).eq("semester_id", semesterId);
  revalidatePath(`/semesters/${semesterId}/settings`);
  return { ok: true, message: "Invitation revoked." };
}

/** Called from /join/[token]. Validation + counting happen atomically in the redeem_invite SQL function. */
export async function joinWithToken(token: string): Promise<ActionResult> {
  const { user } = await requireUser();
  if (!/^[\w-]{20,100}$/.test(token)) return { ok: false, message: "This invitation link is not valid." };
  if (!(await allow(user.id, "invite.redeem", 15, 600))) return { ok: false, message: "Too many attempts. Please wait a few minutes." };
  const { data, error } = await createAdminClient().rpc("redeem_invite", { p_token_hash: hashToken(token), p_user: user.id });
  if (error) return { ok: false, message: "Something went wrong. Please try again." };
  const r = data as unknown as { status: string; semester_id?: string };
  switch (r.status) {
    case "joined": return { ok: true, message: "You've joined the semester!", redirect: `/semesters/${r.semester_id}` };
    case "already_member": return { ok: true, message: "You're already a member.", redirect: `/semesters/${r.semester_id}` };
    case "pending": return { ok: true, message: "Request sent. A moderator will approve you shortly.", redirect: "/my-semesters" };
    case "restricted": return { ok: false, message: "Your account is currently restricted." };
    case "blocked": return { ok: false, message: "You can't rejoin this semester. Contact a moderator." };
    default: return { ok: false, message: "This invitation is expired, revoked, or has reached its limit." };
  }
}

export async function decideRequest(semesterId: string, targetId: string, approve: boolean): Promise<ActionResult> {
  const auth = await authorize(semesterId, "moderator");
  if (!auth.ok || !isUuid(targetId)) return auth.ok ? { ok: false, message: "Invalid request." } : auth.result;
  const { error } = await createAdminClient().rpc("decide_join_request", { p_actor: auth.userId, p_sem: semesterId, p_target: targetId, p_approve: approve });
  if (error) return { ok: false, message: "Not allowed." };
  await notify(targetId, "join", approve ? "Your join request was approved" : "Your join request was declined", approve ? `/semesters/${semesterId}` : "/my-semesters");
  revalidatePath(`/semesters/${semesterId}/members`);
  return { ok: true, message: approve ? "Member approved." : "Request declined." };
}

export async function setRole(semesterId: string, targetId: string, role: string): Promise<ActionResult> {
  const auth = await authorize(semesterId, "owner");
  if (!auth.ok || !isUuid(targetId)) return auth.ok ? { ok: false, message: "Invalid request." } : auth.result;
  const { error } = await createAdminClient().rpc("set_member_role", { p_actor: auth.userId, p_sem: semesterId, p_target: targetId, p_role: role });
  if (error) return { ok: false, message: error.message.includes("forbidden") ? "Only the owner can change roles." : error.message };
  revalidatePath(`/semesters/${semesterId}/members`);
  return { ok: true, message: role === "owner" ? "Ownership transferred." : "Role updated." };
}

export async function removeMember(semesterId: string, targetId: string): Promise<ActionResult> {
  const auth = await authorize(semesterId, "moderator");
  if (!auth.ok || !isUuid(targetId)) return auth.ok ? { ok: false, message: "Invalid request." } : auth.result;
  const { error } = await createAdminClient().rpc("remove_member", { p_actor: auth.userId, p_sem: semesterId, p_target: targetId });
  if (error) return { ok: false, message: "You can't remove that member." };
  revalidatePath(`/semesters/${semesterId}/members`);
  return { ok: true, message: "Member removed." };
}

export async function leaveSemester(semesterId: string): Promise<ActionResult> {
  const { user } = await requireUser();
  if (!isUuid(semesterId)) return { ok: false, message: "Invalid semester." };
  const { data } = await (await createClient()).from("semester_members").delete().eq("semester_id", semesterId).eq("user_id", user.id).select();
  if (!data?.length) return { ok: false, message: "Owners must transfer ownership before leaving." };
  return { ok: true, message: "You left the semester.", redirect: "/my-semesters" };
}

export async function requestGroup(semesterId: string, fd: FormData): Promise<ActionResult> {
  const { user } = await requireUser();
  if (!isUuid(semesterId)) return { ok: false, message: "Choose a semester." };
  const { error } = await (await createClient()).from("semester_requests").insert({ requester_id: user.id, semester_id: semesterId, note: String(fd.get("note") ?? "").slice(0, 500) || null });
  if (error) return { ok: false, message: error.code === "23505" ? "You already requested this semester." : "Could not send the request." };
  return { ok: true, message: "Request sent. An administrator will review it." };
}
