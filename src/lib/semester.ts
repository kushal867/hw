import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/server-db";
import { requireUser, getMembership } from "@/lib/auth";
import { notFound } from "next/navigation";
import type { ActionResult } from "@/components/ui/action-form";
import { createAdminClient } from "@/lib/db";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const isUuid = (s: string) => UUID.test(s);

export const loadSemester = cache(async (id: string) => {
  if (!isUuid(id)) notFound();
  const { data } = await (await createClient()).from("semesters")
    .select("id, semester_number, academic_year, requires_approval, courses(id, name, colleges(id, name, slug))").eq("id", id).maybeSingle();
  if (!data) notFound();
  return data as any;
});

export type Role = "owner" | "moderator" | "member";

/** Server-side gate for semester pages/actions. Returns null role for non-members. */
export const semesterAccess = cache(async (semesterId: string) => {
  const { user, profile } = await requireUser();
  const role = await getMembership(semesterId, user.id);
  const isAdmin = profile.platform_role === "admin";
  return { user, profile, role, isAdmin, canRead: !!role || isAdmin, canModerate: role === "owner" || role === "moderator" || isAdmin };
});

/** For server actions: throws a friendly result if the caller can't act. */
export async function authorize(semesterId: string, need: "member" | "moderator" | "owner"): Promise<
  { ok: true; userId: string; role: Role | null; isAdmin: boolean } | { ok: false; result: ActionResult }> {
  if (!isUuid(semesterId)) return { ok: false, result: { ok: false, message: "Invalid semester." } };
  const a = await semesterAccess(semesterId);
  const allowed = need === "member" ? !!a.role || a.isAdmin : need === "moderator" ? a.canModerate : a.role === "owner" || a.isAdmin;
  if (!allowed) return { ok: false, result: { ok: false, message: "You don't have permission to do that." } };
  if (a.profile.restricted_until && new Date(a.profile.restricted_until) > new Date() && need === "member")
    return { ok: false, result: { ok: false, message: "Your account is currently restricted from contributing." } };
  return { ok: true, userId: a.user.id, role: a.role, isAdmin: a.isAdmin };
}

export async function notify(userId: string, type: string, title: string, destination: string, body?: string) {
  await createAdminClient().from("notifications").insert({ user_id: userId, notification_type: type, title, body, destination });
}
