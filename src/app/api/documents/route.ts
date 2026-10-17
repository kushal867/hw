import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { CATEGORIES } from "@/lib/format";
import { allow, audit, looksLikePdf, sha256 } from "@/lib/security";
import { isUuid } from "@/lib/semester";

const fail = (message: string, status = 400) => NextResponse.json({ ok: false, message }, { status });

const Meta = z.object({
  semesterId: z.string().refine(isUuid, "Invalid semester."),
  subjectId: z.string().refine((s) => s === "" || isUuid(s), "Invalid subject.").optional().default(""),
  title: z.string().trim().min(3, "Title must be at least 3 characters.").max(140),
  description: z.string().trim().max(1000).optional().default(""),
  category: z.string().refine((c) => c in CATEGORIES, "Choose a category."),
  tags: z.string().optional().default(""),
});

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail("Please log in.", 401);

  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > env.maxUploadBytes + 64 * 1024) return fail(`Files must be ${env.maxUploadBytes / 1024 / 1024} MB or smaller.`, 413);

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!form || !(file instanceof File)) return fail("Choose a PDF to upload.");
  const meta = Meta.safeParse(Object.fromEntries([...form.entries()].filter(([, v]) => typeof v === "string")));
  if (!meta.success) return fail(meta.error.issues[0].message);
  const m = meta.data;

  // Authorisation: active member of this semester, not restricted. RLS-checked read of own membership.
  const { data: member } = await supabase.from("semester_members").select("role").eq("semester_id", m.semesterId).eq("user_id", user.id).eq("membership_status", "active").maybeSingle();
  if (!member) return fail("You must be a member of this semester to upload.", 403);
  const { data: me } = await supabase.from("profiles").select("restricted_until").eq("id", user.id).single();
  if (me?.restricted_until && new Date(me.restricted_until) > new Date()) return fail("Your account is currently restricted from uploading.", 403);
  if (!(await allow(user.id, "upload", 10, 3600))) return fail("Upload limit reached. Try again in an hour.", 429);

  if (file.size === 0 || file.size > env.maxUploadBytes) return fail(`Files must be ${env.maxUploadBytes / 1024 / 1024} MB or smaller.`, 413);
  const buf = Buffer.from(await file.arrayBuffer());
  if (!looksLikePdf(buf)) return fail("That file isn't a valid PDF (or contains embedded scripts).", 415); // content-based, ignores name and client MIME
  const hash = sha256(buf);

  const admin = createAdminClient();
  const { data: dup } = await admin.from("documents").select("id").eq("semester_id", m.semesterId).eq("sha256", hash).maybeSingle();
  if (dup) return fail("This exact file has already been uploaded to this semester.", 409);

  if (m.subjectId) {
    const { data: sub } = await supabase.from("subjects").select("id").eq("id", m.subjectId).eq("semester_id", m.semesterId).maybeSingle();
    if (!sub) return fail("That subject doesn't belong to this semester.");
  }
  const tags = [...new Set(m.tags.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean))].slice(0, 8);
  if (tags.some((t) => t.length > 30)) return fail("Tags must be 30 characters or fewer.");

  const path = `${m.semesterId}/${randomUUID()}.pdf`; // server-chosen path; never derived from the client filename
  const up = await admin.storage.from("documents").upload(path, buf, { contentType: "application/pdf", upsert: false });
  if (up.error) return fail("Upload failed. Please try again.", 500);

  const { data: doc, error } = await admin.from("documents").insert({
    uploaded_by: user.id, semester_id: m.semesterId, subject_id: m.subjectId || null, title: m.title, description: m.description || null,
    tags, category: m.category, storage_path: path, size_bytes: buf.length, mime_type: "application/pdf", sha256: hash,
  }).select("id").single();
  if (error) { await admin.storage.from("documents").remove([path]); return fail("Could not save the document.", 500); } // no orphaned files
  await audit(user.id, "document.upload", "document", doc.id, { semester: m.semesterId, size: buf.length });
  return NextResponse.json({ ok: true, id: doc.id });
}
