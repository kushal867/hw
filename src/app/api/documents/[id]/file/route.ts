import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { servePdf } from "@/lib/serve-file";

// Private path: RLS on `documents` only returns the row to active group members / moderators / admins.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new NextResponse("Not found", { status: 404 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });
  const { data: doc } = await supabase.from("documents").select("storage_path,title,moderation_status").eq("id", id).maybeSingle();
  if (!doc || doc.moderation_status === "removed") return new NextResponse("Not found", { status: 404 }); // 404, not 403: don't reveal existence
  return servePdf(doc.storage_path, doc.title, req.nextUrl.searchParams.get("download") === "1", "private");
}
