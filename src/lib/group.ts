import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/server-db";
import { requireUser, getMembership } from "@/lib/auth";
import type { ActionResult } from "@/components/ui/action-form";
import { createAdminClient } from "@/lib/db";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const isUuid = (s: string) => UUID.test(s);

export type GroupRow = {
  id: string; name: string; description: string | null; visibility: "public" | "private";
  join_policy: "open" | "approval" | "invite_only"; status: "active" | "archived"; created_by: string | null; semester_id: string | null;
  semesters: { id: string; semester_number: number; academic_year: string | null; courses: { id: string; name: string; term_label: string; colleges: { id: string; name: string; slug: string } } } | null;
};

/** Returns the group only if RLS lets this user see it (public groups, or groups they belong to). Null otherwise. */
export const loadGroup = cache(async (id: string): Promise<GroupRow | null> => {
  if (!isUuid(id)) return null;
  const { data } = await (await createClient()).from("groups")
    .select("id,name,description,visibility,join_policy,status,created_by,semester_id,semesters(id,semester_number,academic_year,courses(id,name,term_label,colleges(id,name,slug)))")
    .eq("id", id).maybeSingle();
  return (data as unknown as GroupRow) ?? null;
});

export type Role = "owner" | "moderator" | "member";

/** Server-side gate for group pages/actions. `role` is null for non-members. */
export const groupAccess = cache(async (groupId: string) => {
  const { user, profile } = await requireUser();
  const role = await getMembership(groupId, user.id);
  const isAdmin = profile.platform_role === "admin";
  return { user, profile, role, isAdmin, canRead: !!role || isAdmin, canModerate: role === "owner" || role === "moderator" || isAdmin, isOwner: role === "owner" || isAdmin };
});

/** For server actions: returns a friendly failure result when the caller isn't allowed. */
export async function authorize(groupId: string, need: "member" | "moderator" | "owner"): Promise<
  { ok: true; userId: string; role: Role | null; isAdmin: boolean } | { ok: false; result: ActionResult }> {
  if (!isUuid(groupId)) return { ok: false, result: { ok: false, message: "Invalid group." } };
  const a = await groupAccess(groupId);
  const allowed = need === "member" ? a.canRead : need === "moderator" ? a.canModerate : a.isOwner;
  if (!allowed) return { ok: false, result: { ok: false, message: "You don't have permission to do that." } };
  if (a.profile.restricted_until && new Date(a.profile.restricted_until) > new Date() && need === "member")
    return { ok: false, result: { ok: false, message: "Your account is currently restricted from contributing." } };
  return { ok: true, userId: a.user.id, role: a.role, isAdmin: a.isAdmin };
}

export async function notify(userId: string, type: string, title: string, destination: string, body?: string) {
  await createAdminClient().from("notifications").insert({ user_id: userId, notification_type: type, title, body, destination });
}
