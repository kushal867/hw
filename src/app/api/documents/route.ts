import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { z } from "zod";
import { createClient } from "@/lib/server-db";
import { getSessionUser } from "@/lib/session";
import { putFile, removeFiles } from "@/lib/storage";
import { createAdminClient } from "@/lib/db";
import { env } from "@/lib/env";
import { CATEGORIES } from "@/lib/format";
import { allow, audit, looksLikePdf, sha256 } from "@/lib/security";
import { isUuid } from "@/lib/group";

const fail = (message: string, status = 400) => NextResponse.json({ ok: false, message }, { status });

const Meta = z.object({
  groupId: z.string().refine(isUuid, "Invalid group."),
  subjectId: z.string().refine((s) => s === "" || isUuid(s), "Invalid subject.").optional().default(""),
  title: z.string().trim().min(3, "Title must be at least 3 characters.").max(140),
  description: z.string().trim().max(1000).optional().default(""),
  category: z.string().refine((c) => c in CATEGORIES, "Choose a category."),
  tags: z.string().optional().default(""),
});

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  const supabase = await createClient();
  if (!user) return fail("Please log in.", 401);

  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > env.maxUploadBytes + 64 * 1024) return fail(`Files must be ${env.maxUploadBytes / 1024 / 1024} MB or smaller.`, 413);

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!form || !(file instanceof File)) return fail("Choose a PDF to upload.");
  const meta = Meta.safeParse(Object.fromEntries([...form.entries()].filter(([, v]) => typeof v === "string")));
  if (!meta.success) return fail(meta.error.issues[0].message);
  const m = meta.data;

  // Authorisation: active member of this group, not restricted. RLS-checked read of own membership.
  const { data: member } = await supabase.from("group_members").select("role").eq("group_id", m.groupId).eq("user_id", user.id).eq("membership_status", "active").maybeSingle();
  if (!member) return fail("You must be a member of this group to upload.", 403);
  const { data: me } = await supabase.from("profiles").select("restricted_until").eq("id", user.id).single();
  if (me?.restricted_until && new Date(me.restricted_until) > new Date()) return fail("Your account is currently restricted from uploading.", 403);
  if (!(await allow(user.id, "upload", 10, 3600))) return fail("Upload limit reached. Try again in an hour.", 429);

  if (file.size === 0 || file.size > env.maxUploadBytes) return fail(`Files must be ${env.maxUploadBytes / 1024 / 1024} MB or smaller.`, 413);
  const buf = Buffer.from(await file.arrayBuffer());
  if (!looksLikePdf(buf)) return fail("That file isn't a valid PDF (or contains embedded scripts).", 415); // content-based, ignores name and client MIME
  const hash = sha256(buf);

  const admin = createAdminClient();
  const { data: dup } = await admin.from("documents").select("id").eq("group_id", m.groupId).eq("sha256", hash).maybeSingle();
  if (dup) return fail("This exact file has already been uploaded to this group.", 409);

  if (m.subjectId) { // subjects exist only for groups linked to a semester, and must belong to that semester
    const { data: g } = await supabase.from("groups").select("semester_id").eq("id", m.groupId).maybeSingle();
    const { data: sub } = g?.semester_id ? await supabase.from("subjects").select("id").eq("id", m.subjectId).eq("semester_id", g.semester_id).maybeSingle() : { data: null };
    if (!sub) return fail("That subject doesn't belong to this group's semester.");
  }
  const tags = [...new Set(m.tags.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean))].slice(0, 8);
  if (tags.some((t) => t.length > 30)) return fail("Tags must be 30 characters or fewer.");

  const path = `${m.groupId}/${randomUUID()}.pdf`; // server-chosen path; never derived from the client filename
  try { await putFile("documents", path, buf); } catch { return fail("Upload failed. Please try again.", 500); }

  const { data: doc, error } = await admin.from("documents").insert({
    uploaded_by: user.id, group_id: m.groupId, subject_id: m.subjectId || null, title: m.title, description: m.description || null,
    tags, category: m.category, storage_path: path, size_bytes: buf.length, mime_type: "application/pdf", sha256: hash,
  }).select("id").single();
  if (error) { await removeFiles("documents", [path]); return fail("Could not save the document.", 500); } // no orphaned files
  await audit(user.id, "document.upload", "document", doc.id, { group: m.groupId, size: buf.length });
  return NextResponse.json({ ok: true, id: doc.id });
}
