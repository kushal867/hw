import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { allow } from "@/lib/security";

const MAX = 1024 * 1024;
const kind = (b: Buffer) =>
  b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) ? "png"
  : b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff ? "jpg"
  : b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP" ? "webp" : null;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, message: "Please log in." }, { status: 401 });
  if (!(await allow(user.id, "avatar", 10, 3600))) return NextResponse.json({ ok: false, message: "Too many changes. Try later." }, { status: 429 });
  const file = (await req.formData().catch(() => null))?.get("file");
  if (!(file instanceof File) || file.size === 0 || file.size > MAX) return NextResponse.json({ ok: false, message: "Choose an image up to 1 MB." }, { status: 400 });
  const buf = Buffer.from(await file.arrayBuffer());
  const ext = kind(buf); // detect by signature, not by filename/MIME
  if (!ext) return NextResponse.json({ ok: false, message: "Use a PNG, JPG or WebP image." }, { status: 415 });
  const admin = createAdminClient();
  const path = `${user.id}/${Date.now()}.${ext}`;
  const up = await admin.storage.from("avatars").upload(path, buf, { contentType: ext === "jpg" ? "image/jpeg" : `image/${ext}`, upsert: false });
  if (up.error) return NextResponse.json({ ok: false, message: "Upload failed." }, { status: 500 });
  const { data: old } = await supabase.from("profiles").select("avatar_path").eq("id", user.id).single();
  await supabase.from("profiles").update({ avatar_path: path }).eq("id", user.id);
  if (old?.avatar_path) await admin.storage.from("avatars").remove([old.avatar_path]);
  return NextResponse.json({ ok: true });
}
