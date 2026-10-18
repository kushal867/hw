import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { imageKind } from "@/lib/images";
import { audit } from "@/lib/security";
import { isUuid } from "@/lib/group";
import { putFile, removeFiles } from "@/lib/storage";

const MAX = 2 * 1024 * 1024;
const fail = (message: string, status = 400) => NextResponse.json({ ok: false, message }, { status });

async function adminOnly() {
  const me = await getCurrentUser();
  return me?.profile.platform_role === "admin" ? me : null;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const me = await adminOnly(); if (!me) return fail("Not allowed.", 403);
  const { id } = await params; if (!isUuid(id)) return fail("Invalid college.");
  const file = (await req.formData().catch(() => null))?.get("file");
  if (!(file instanceof File) || file.size === 0 || file.size > MAX) return fail("Choose an image up to 2 MB.");
  const buf = Buffer.from(await file.arrayBuffer());
  const ext = imageKind(buf);
  if (!ext) return fail("Use a PNG, JPG or WebP image.", 415);
  const db = createAdminClient();
  const { data: college } = await db.from("colleges").select("logo_path").eq("id", id).maybeSingle();
  if (!college) return fail("College not found.", 404);
  const path = `${id}/${Date.now()}.${ext}`;
  try { await putFile("colleges", path, buf); } catch { return fail("Upload failed.", 500); }
  const { error } = await db.from("colleges").update({ logo_path: path }).eq("id", id);
  if (error) { await removeFiles("colleges", [path]); return fail("Could not save the photo.", 500); }
  if (college.logo_path) await removeFiles("colleges", [college.logo_path]);
  await audit(me.user.id, "college.photo", "college", id);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const me = await adminOnly(); if (!me) return fail("Not allowed.", 403);
  const { id } = await params; if (!isUuid(id)) return fail("Invalid college.");
  const db = createAdminClient();
  const { data: college } = await db.from("colleges").select("logo_path").eq("id", id).maybeSingle();
  if (!college?.logo_path) return NextResponse.json({ ok: true });
  await db.from("colleges").update({ logo_path: null }).eq("id", id);
  await removeFiles("colleges", [college.logo_path]);
  await audit(me.user.id, "college.photo_remove", "college", id);
  return NextResponse.json({ ok: true });
}
