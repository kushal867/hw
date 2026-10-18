import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/server-db";
import { getSessionUser } from "@/lib/session";

export type Profile = {
  id: string; display_name: string; username: string | null; avatar_path: string | null;
  preferred_language: "en" | "ne"; bio: string | null; platform_role: "user" | "admin";
  restricted_until: string | null; college_id: string | null; course_id: string | null; semester_id: string | null;
};

/** Authoritative identity: the session token is looked up in the database on every request. */
export const getCurrentUser = cache(async () => {
  const user = await getSessionUser();
  if (!user) return null;
  const { data: profile } = await (await createClient()).from("profiles").select("*").eq("id", user.id).single();
  return profile ? { user, profile: profile as unknown as Profile } : null;
});

export async function requireUser() {
  const me = await getCurrentUser();
  if (!me) redirect("/login");
  return me;
}

export async function requireAdmin() {
  const me = await requireUser();
  if (me.profile.platform_role !== "admin") redirect("/dashboard");
  return me;
}

export const isRestricted = (p: Profile) => !!p.restricted_until && new Date(p.restricted_until) > new Date();

/** Role of the current user in a semester, or null when not an active member. */
export async function getMembership(groupId: string, userId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("group_members").select("role, membership_status")
    .eq("group_id", groupId).eq("user_id", userId).maybeSingle();
  return data && data.membership_status === "active" ? (data.role as "owner" | "moderator" | "member") : null;
}
