"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/db";
import { authorize, isUuid } from "@/lib/group";
import { allow } from "@/lib/security";
import { createClient } from "@/lib/server-db";
import { EVENT_KINDS, formatDate, nepalLocalToDate } from "@/lib/format";
import type { ActionResult } from "@/components/ui/action-form";

const Input = z.object({
  title: z.string().trim().min(3, "Give the event a short title.").max(120),
  description: z.string().trim().max(500, "Description is limited to 500 characters."),
  kind: z.enum(["exam", "assignment", "class", "other"], { message: "Choose a type." }),
  when: z.string().min(1, "Choose a date and time."),
});

/** Moderators and owners add exams, deadlines and classes. Row-level security enforces the same rule in the database. */
export async function createEvent(groupId: string, fd: FormData): Promise<ActionResult> {
  const auth = await authorize(groupId, "moderator");
  if (!auth.ok) return auth.result;
  const p = Input.safeParse({ title: fd.get("title"), description: fd.get("description") ?? "", kind: fd.get("kind"), when: fd.get("when") });
  if (!p.success) return { ok: false, message: p.error.issues[0].message };
  const at = nepalLocalToDate(p.data.when);
  if (!at) return { ok: false, message: "Enter a valid date and time." };
  if (+at < Date.now() - 86_400_000) return { ok: false, message: "That date is in the past." };
  if (+at > Date.now() + 366 * 86_400_000) return { ok: false, message: "Events can be at most a year ahead." };
  if (!(await allow(auth.userId, "event.create", 30, 3600))) return { ok: false, message: "You're adding events too fast. Try again later." };
  const { error } = await (await createClient()).from("group_events").insert({
    group_id: groupId, title: p.data.title, description: p.data.description || null, kind: p.data.kind, starts_at: at.toISOString(), created_by: auth.userId });
  if (error) return { ok: false, message: "Could not save the event." };
  // Tell the other members right away (the day-before reminder is sent separately by the server).
  const admin = createAdminClient();
  const { data: members } = await admin.from("group_members").select("user_id").eq("group_id", groupId).eq("membership_status", "active").limit(1000);
  const rows = (members ?? []).filter((m: any) => m.user_id !== auth.userId).map((m: any) => ({
    user_id: m.user_id, notification_type: "event", title: `New ${EVENT_KINDS[p.data.kind].toLowerCase()}: ${p.data.title}`, body: formatDate(at, true), destination: `/groups/${groupId}/events` }));
  if (rows.length) await admin.from("notifications").insert(rows);
  revalidatePath(`/groups/${groupId}/events`); revalidatePath(`/groups/${groupId}`);
  return { ok: true, message: "Event added. Members were notified." };
}

export async function deleteEvent(groupId: string, eventId: string): Promise<ActionResult> {
  const auth = await authorize(groupId, "moderator");
  if (!auth.ok || !isUuid(eventId)) return auth.ok ? { ok: false, message: "Invalid event." } : auth.result;
  const { data } = await (await createClient()).from("group_events").delete().eq("id", eventId).eq("group_id", groupId).select("id");
  if (!data?.length) return { ok: false, message: "You can't delete this event." };
  revalidatePath(`/groups/${groupId}/events`); revalidatePath(`/groups/${groupId}`);
  return { ok: true, message: "Event deleted." };
}
