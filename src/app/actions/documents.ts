"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/server-db";
import { createAdminClient } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/security";
import { removeFiles } from "@/lib/storage";
import { CATEGORIES, PUBLISHABLE } from "@/lib/format";
import { isUuid } from "@/lib/group";
import type { ActionResult } from "@/components/ui/action-form";


export async function updateDocument(id: string, fd: FormData): Promise<ActionResult> {
  await requireUser();
  const p = z.object({ title: z.string().trim().min(3).max(140), description: z.string().trim().max(1000), category: z.string().refine((c) => c in CATEGORIES),
    tags: z.string(), subjectId: z.string() }).safeParse(Object.fromEntries(fd));
  if (!p.success) return { ok: false, message: "Check the title and category." };
  const tags = [...new Set(p.data.tags.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean))].slice(0, 8);
  // Column grants + RLS limit this to the uploader's own metadata; protected columns are rejected by trigger.
  const { data, error } = await (await createClient()).from("documents").update({
    title: p.data.title, description: p.data.description || null, category: p.data.category, tags, subject_id: p.data.subjectId || null }).eq("id", id).select("group_id");
  if (error || !data?.length) return { ok: false, message: "You can't edit this document." };
  revalidatePath(`/groups/${data[0].group_id}/files`);
  return { ok: true, message: "Document updated." };
}

export async function deleteDocument(id: string): Promise<ActionResult> {
  const { user } = await requireUser();
  if (!isUuid(id)) return { ok: false, message: "Invalid document." };
  const supabase = await createClient();
  const { data: doc } = await supabase.from("documents").select("storage_path,group_id").eq("id", id).maybeSingle();
  if (!doc) return { ok: false, message: "Document not found." };
  const { data, error } = await supabase.from("documents").delete().eq("id", id).select("id"); // RLS: uploader, group moderator or admin
  if (error || !data?.length) return { ok: false, message: "You can't delete this document." };
  await removeFiles("documents", [doc.storage_path]);
  await audit(user.id, "document.delete", "document", id);
  revalidatePath(`/groups/${doc.group_id}/files`);
  return { ok: true, message: "Document deleted." };
}

/** Uploader asks for public publication. It stays private until an admin approves it. */
export async function requestPublication(id: string): Promise<ActionResult> {
  const { user, profile } = await requireUser();
  if (!isUuid(id)) return { ok: false, message: "Invalid document." };
  if (profile.restricted_until && new Date(profile.restricted_until) > new Date()) return { ok: false, message: "Your account is restricted." };
  const admin = createAdminClient();
  const { data: doc } = await admin.from("documents").select("uploaded_by,category,moderation_status,group_id").eq("id", id).maybeSingle();
  if (!doc || doc.uploaded_by !== user.id) return { ok: false, message: "Only the uploader can publish a document." };
  if (!PUBLISHABLE.has(doc.category)) return { ok: false, message: "Homework, assignments and lab reports can't be published publicly." };
  if (!["private", "rejected"].includes(doc.moderation_status)) return { ok: false, message: "This document is already under review or published." };
  const { count } = await admin.from("reports").select("id", { count: "exact", head: true }).eq("target_type", "document").eq("target_id", id).eq("status", "actioned");
  if (count) return { ok: false, message: "This document can't be published." };
  await admin.from("documents").update({ moderation_status: "pending" }).eq("id", id);
  await audit(user.id, "document.publish_request", "document", id);
  revalidatePath(`/groups/${doc.group_id}/files`);
  return { ok: true, message: "Submitted for review. It stays private until approved." };
}

export async function withdrawPublication(id: string): Promise<ActionResult> {
  const { user } = await requireUser();
  const admin = createAdminClient();
  const { data: doc } = await admin.from("documents").select("uploaded_by,group_id").eq("id", id).maybeSingle();
  if (!doc || doc.uploaded_by !== user.id) return { ok: false, message: "Not allowed." };
  await admin.from("documents").update({ visibility: "private", moderation_status: "private", published_at: null }).eq("id", id);
  await audit(user.id, "document.unpublish", "document", id);
  revalidatePath(`/groups/${doc.group_id}/files`);
  return { ok: true, message: "Document is private again." };
}
