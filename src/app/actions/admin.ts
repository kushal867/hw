"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { adminSql, createAdminClient } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/security";
import { removeFiles } from "@/lib/storage";
import { isUuid, notify } from "@/lib/semester";
import { slugify } from "@/lib/format";
import type { ActionResult } from "@/components/ui/action-form";

// Every admin action re-checks the platform role on the server; UI visibility is never the gate.

export async function reviewDocument(id: string, approve: boolean): Promise<ActionResult> {
  const { user } = await requireAdmin();
  if (!isUuid(id)) return { ok: false, message: "Invalid document." };
  const db = createAdminClient();
  const { data: doc } = await db.from("documents").select("uploaded_by,title,moderation_status").eq("id", id).maybeSingle();
  if (!doc || doc.moderation_status !== "pending") return { ok: false, message: "This document isn't awaiting review." };
  await db.from("documents").update(approve ? { visibility: "public", moderation_status: "approved", published_at: new Date().toISOString() } : { moderation_status: "rejected" }).eq("id", id);
  await audit(user.id, approve ? "document.approve" : "document.reject", "document", id);
  await notify(doc.uploaded_by, "publication", approve ? "Your PDF is now public" : "Your PDF was not approved for public sharing", approve ? `/public-notes/${id}` : "/my-semesters", doc.title);
  revalidatePath("/admin/content");
  return { ok: true, message: approve ? "Approved and published." : "Rejected." };
}

export async function removeDocument(id: string): Promise<ActionResult> {
  const { user } = await requireAdmin();
  await createAdminClient().from("documents").update({ visibility: "private", moderation_status: "removed", published_at: null }).eq("id", id);
  await audit(user.id, "document.remove", "document", id);
  revalidatePath("/admin/content"); revalidatePath("/admin/reports");
  return { ok: true, message: "Document removed from all views." };
}

export async function resolveReport(id: string, outcome: "actioned" | "dismissed", hideTarget = false): Promise<ActionResult> {
  const { user } = await requireAdmin();
  const db = createAdminClient();
  const { data: r } = await db.from("reports").select("target_type,target_id").eq("id", id).maybeSingle();
  if (!r) return { ok: false, message: "Report not found." };
  if (outcome === "actioned" && hideTarget) {
    if (r.target_type === "document") await db.from("documents").update({ visibility: "private", moderation_status: "removed", published_at: null }).eq("id", r.target_id);
    if (r.target_type === "post") await db.from("discussion_posts").update({ status: "removed" }).eq("id", r.target_id);
    if (r.target_type === "comment") await db.from("discussion_comments").update({ status: "removed" }).eq("id", r.target_id);
    if (r.target_type === "question") await db.from("exam_questions").update({ status: "removed" }).eq("id", r.target_id);
  }
  await db.from("reports").update({ status: outcome, reviewed_by: user.id, reviewed_at: new Date().toISOString() }).eq("id", id);
  await audit(user.id, `report.${outcome}`, r.target_type, r.target_id, { report: id, hidden: hideTarget });
  revalidatePath("/admin/reports");
  return { ok: true, message: outcome === "actioned" ? "Report actioned." : "Report dismissed." };
}

export async function restrictUser(userId: string, days: number, reason: string): Promise<ActionResult> {
  const { user } = await requireAdmin();
  if (!isUuid(userId) || userId === user.id) return { ok: false, message: "Invalid user." };
  const until = days > 0 ? new Date(Date.now() + days * 86400_000).toISOString() : null;
  await createAdminClient().from("profiles").update({ restricted_until: until, restriction_reason: days > 0 ? reason.slice(0, 300) : null }).eq("id", userId);
  await audit(user.id, days > 0 ? "user.restrict" : "user.unrestrict", "user", userId, { days, reason });
  revalidatePath("/admin/users");
  return { ok: true, message: days > 0 ? "User restricted." : "Restriction lifted." };
}

export async function completeDeletion(requestId: string): Promise<ActionResult> {
  const { user } = await requireAdmin();
  const db = createAdminClient();
  const { data: r } = await db.from("deletion_requests").select("user_id,status").eq("id", requestId).maybeSingle();
  if (!r || r.status !== "open") return { ok: false, message: "Request not open." };
  const { data: files } = await db.from("documents").select("storage_path").eq("uploaded_by", r.user_id);
  const { data: prof } = await db.from("profiles").select("avatar_path").eq("id", r.user_id).maybeSingle();
  let error: { message: string } | null = null;
  try { await adminSql("delete from auth.users where id = $1", [r.user_id]); }   // cascades profile, posts, documents rows
  catch (e: any) { error = { message: String(e?.message ?? "") }; }
  if (!error) {
    if (files?.length) await removeFiles("documents", files.map((f: { storage_path: string }) => f.storage_path));
    if (prof?.avatar_path) await removeFiles("avatars", [prof.avatar_path]);
  }
  if (error) return { ok: false, message: error.message.includes("owner") ? "User owns a semester: transfer ownership first." : "Deletion failed." };
  await audit(user.id, "user.delete", "user", r.user_id, { request: requestId });
  revalidatePath("/admin/users");
  return { ok: true, message: "Account and data deleted." };
}

// ───────── Hierarchy management ─────────
const dup = (e: { code?: string } | null) => (e?.code === "23505" ? "That record already exists." : "Could not save.");

export async function addCollege(fd: FormData): Promise<ActionResult> {
  const { user } = await requireAdmin();
  const p = z.object({ name: z.string().trim().min(2).max(160), city: z.string().trim().max(80) }).safeParse(Object.fromEntries(fd));
  if (!p.success) return { ok: false, message: "Enter a college name." };
  const { error } = await createAdminClient().from("colleges").insert({ name: p.data.name, city: p.data.city || null, slug: slugify(`${p.data.name} ${p.data.city}`) });
  if (error) return { ok: false, message: dup(error) };
  await audit(user.id, "college.create", "college", p.data.name);
  revalidatePath("/admin/colleges");
  return { ok: true, message: "College added." };
}
export async function addCourse(fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  const p = z.object({ college: z.string().refine(isUuid, "Choose a college."), name: z.string().trim().min(2).max(120), level: z.string().trim().max(40) }).safeParse(Object.fromEntries(fd));
  if (!p.success) return { ok: false, message: p.error.issues[0].message };
  const { error } = await createAdminClient().from("courses").insert({ college_id: p.data.college, name: p.data.name, slug: slugify(p.data.name), degree_level: p.data.level || null });
  if (error) return { ok: false, message: dup(error) };
  revalidatePath("/admin/colleges");
  return { ok: true, message: "Course added." };
}
export async function addSemester(fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  const p = z.object({ course: z.string().refine(isUuid, "Choose a course."), number: z.coerce.number().int().min(1).max(12), year: z.string().trim().max(20) }).safeParse(Object.fromEntries(fd));
  if (!p.success) return { ok: false, message: p.error.issues[0].message };
  const { error } = await createAdminClient().from("semesters").insert({ course_id: p.data.course, semester_number: p.data.number, academic_year: p.data.year || null });
  if (error) return { ok: false, message: dup(error) };
  revalidatePath("/admin/colleges");
  return { ok: true, message: "Semester added." };
}
export async function addSubject(fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  const p = z.object({ semester: z.string().refine(isUuid, "Choose a semester."), name: z.string().trim().min(2).max(160), code: z.string().trim().max(30) }).safeParse(Object.fromEntries(fd));
  if (!p.success) return { ok: false, message: p.error.issues[0].message };
  const { error } = await createAdminClient().from("subjects").insert({ semester_id: p.data.semester, name: p.data.name, code: p.data.code || null });
  if (error) return { ok: false, message: dup(error) };
  revalidatePath("/admin/colleges");
  return { ok: true, message: "Subject added." };
}
export async function assignOwner(semesterId: string, userId: string): Promise<ActionResult> {
  const { user } = await requireAdmin();
  if (!isUuid(semesterId) || !isUuid(userId)) return { ok: false, message: "Invalid request." };
  const { error } = await createAdminClient().rpc("admin_assign_owner", { p_actor: user.id, p_sem: semesterId, p_user: userId });
  if (error) return { ok: false, message: "Could not assign owner." };
  await notify(userId, "group", "You're now the owner of a semester group", `/semesters/${semesterId}`);
  revalidatePath("/admin/colleges");
  return { ok: true, message: "Owner assigned." };
}
export async function archiveRecord(table: "colleges" | "courses" | "semesters" | "subjects", id: string, status: "active" | "archived"): Promise<ActionResult> {
  const { user } = await requireAdmin();
  if (!["colleges", "courses", "semesters", "subjects"].includes(table) || !isUuid(id)) return { ok: false, message: "Invalid." };
  await createAdminClient().from(table).update({ status }).eq("id", id);
  await audit(user.id, `${table}.${status}`, table, id);
  revalidatePath("/admin/colleges");
  return { ok: true, message: status === "archived" ? "Archived." : "Restored." };
}
