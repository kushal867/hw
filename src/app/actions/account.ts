"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/server-db";
import { requireUser } from "@/lib/auth";
import { allow } from "@/lib/security";
import { isUuid } from "@/lib/semester";
import type { ActionResult } from "@/components/ui/action-form";

export async function updateProfile(fd: FormData): Promise<ActionResult> {
  const { user } = await requireUser();
  const p = z.object({
    display_name: z.string().trim().min(2, "Name must be at least 2 characters.").max(60),
    username: z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,30}$/, "Username: 3–30 letters, numbers or underscores.").or(z.literal("")),
    bio: z.string().trim().max(280, "Bio is limited to 280 characters."),
    preferred_language: z.enum(["en", "ne"]),
    college_id: z.string().refine((s) => s === "" || isUuid(s)), course_id: z.string().refine((s) => s === "" || isUuid(s)), semester_id: z.string().refine((s) => s === "" || isUuid(s)),
  }).safeParse(Object.fromEntries(fd));
  if (!p.success) return { ok: false, message: p.error.issues[0].message };
  const d = p.data;
  // The pickers are only a convenience: re-check that semester ∈ course ∈ college so a crafted request can't mix colleges.
  const db = await createClient();
  if (d.semester_id && !d.course_id) return { ok: false, message: "Choose a course for that semester." };
  if (d.course_id && !d.college_id) return { ok: false, message: "Choose a college first." };
  if (d.course_id) {
    const { data: c } = await db.from("courses").select("college_id").eq("id", d.course_id).maybeSingle();
    if (!c || c.college_id !== d.college_id) return { ok: false, message: "That course doesn't belong to the selected college." };
  }
  if (d.semester_id) {
    const { data: s } = await db.from("semesters").select("course_id").eq("id", d.semester_id).maybeSingle();
    if (!s || s.course_id !== d.course_id) return { ok: false, message: "That semester doesn't belong to the selected course." };
  }
  // Column grants limit this update to profile fields; role/restriction columns are unreachable.
  const { error } = await (await createClient()).from("profiles").update({
    display_name: d.display_name, username: d.username || null, bio: d.bio || null, preferred_language: d.preferred_language,
    college_id: d.college_id || null, course_id: d.course_id || null, semester_id: d.semester_id || null }).eq("id", user.id);
  if (error) return { ok: false, message: error.code === "23505" ? "That username is taken." : "Could not save your profile." };
  revalidatePath("/profile");
  return { ok: true, message: "Profile saved." };
}

export async function requestDeletion(): Promise<ActionResult> {
  const { user } = await requireUser();
  const { error } = await (await createClient()).from("deletion_requests").insert({ user_id: user.id });
  return error ? { ok: false, message: "Could not submit the request." } : { ok: true, message: "Deletion requested. An administrator will process it." };
}

export async function markRead(id?: string): Promise<ActionResult> {
  const { user } = await requireUser();
  let q = (await createClient()).from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", user.id).is("read_at", null);
  if (id) q = q.eq("id", id);
  await q;
  revalidatePath("/notifications");
  return { ok: true };
}

const TYPES = ["document", "post", "comment", "question", "user", "copyright"] as const;
export async function submitReport(fd: FormData): Promise<ActionResult> {
  const { user } = await requireUser();
  const p = z.object({
    type: z.enum(TYPES, { message: "Choose what you are reporting." }), id: z.string().refine(isUuid, "Enter a valid content ID."),
    reason: z.enum(["spam", "inappropriate", "copyright", "harassment", "wrong_info", "other"], { message: "Choose a reason." }),
    details: z.string().trim().max(1000, "Details are limited to 1000 characters."),
  }).safeParse(Object.fromEntries(fd));
  if (!p.success) return { ok: false, message: p.error.issues[0].message };
  if (!(await allow(user.id, "report", 10, 3600))) return { ok: false, message: "Too many reports. Please try again later." };
  const { error } = await (await createClient()).from("reports").insert({ reporter_id: user.id, target_type: p.data.type, target_id: p.data.id, reason: p.data.reason, details: p.data.details || null });
  return error ? { ok: false, message: "Could not submit the report." } : { ok: true, message: "Thank you. Our moderators will review this.", redirect: "/dashboard" };
}
