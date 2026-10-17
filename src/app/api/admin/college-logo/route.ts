import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { audit } from "@/lib/security";
import { isUuid } from "@/lib/semester";

const MAX = 2 * 1024 * 1024;
const kind = (b: Buffer) =>
  b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) ? "png"
  : b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff ? "jpg"
  : b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP" ? "webp" : null;
const fail = (message: string, status = 400) => NextResponse.json({ ok: false, message }, { status });

// Admin-only: the platform role is read from the database with the caller's verified session, never from the request.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail("Please log in.", 401);
  const { data: me } = await supabase.from("profiles").select("platform_role").eq("id", user.id).single();
  if (me?.platform_role !== "admin") return fail("Not allowed.", 403);

  const form = await req.formData().catch(() => null);
  const file = form?.get("file"); const id = String(form?.get("collegeId") ?? "");
  if (!(file instanceof File) || !isUuid(id) || file.size === 0 || file.size > MAX) return fail("Choose an image up to 2 MB.");
  const buf = Buffer.from(await file.arrayBuffer());
  const ext = kind(buf);
  if (!ext) return fail("Use a PNG, JPG or WebP image.", 415);

  const db = createAdminClient();
  const { data: college } = await db.from("colleges").select("logo_path").eq("id", id).maybeSingle();
  if (!college) return fail("College not found.", 404);
  const path = `${id}/${Date.now()}.${ext}`;
  const up = await db.storage.from("college-logos").upload(path, buf, { contentType: ext === "jpg" ? "image/jpeg" : `image/${ext}`, upsert: false });
  if (up.error) return fail("Upload failed.", 500);
  await db.from("colleges").update({ logo_path: path }).eq("id", id);
  if (college.logo_path) await db.storage.from("college-logos").remove([college.logo_path]);
  await audit(user.id, "college.logo", "college", id);
  return NextResponse.json({ ok: true });
}
