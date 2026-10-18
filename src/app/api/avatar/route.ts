import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/server-db";
import { getSessionUser } from "@/lib/session";
import { putFile, removeFiles } from "@/lib/storage";
import { allow } from "@/lib/security";
import { imageKind } from "@/lib/images";

const MAX = 1024 * 1024;
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  const supabase = await createClient();
  if (!user) return NextResponse.json({ ok: false, message: "Please log in." }, { status: 401 });
  if (!(await allow(user.id, "avatar", 10, 3600))) return NextResponse.json({ ok: false, message: "Too many changes. Try later." }, { status: 429 });
  const file = (await req.formData().catch(() => null))?.get("file");
  if (!(file instanceof File) || file.size === 0 || file.size > MAX) return NextResponse.json({ ok: false, message: "Choose an image up to 1 MB." }, { status: 400 });
  const buf = Buffer.from(await file.arrayBuffer());
  const ext = imageKind(buf); // detect by signature, not by filename/MIME
  if (!ext) return NextResponse.json({ ok: false, message: "Use a PNG, JPG or WebP image." }, { status: 415 });
  const path = `${user.id}/${Date.now()}.${ext}`;
  try { await putFile("avatars", path, buf); } catch { return NextResponse.json({ ok: false, message: "Upload failed." }, { status: 500 }); }
  const { data: old } = await supabase.from("profiles").select("avatar_path").eq("id", user.id).single();
  await supabase.from("profiles").update({ avatar_path: path }).eq("id", user.id);
  if (old?.avatar_path) await removeFiles("avatars", [old.avatar_path]);
  return NextResponse.json({ ok: true });
}
