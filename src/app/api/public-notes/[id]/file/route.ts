import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { servePdf } from "@/lib/serve-file";

// Public path: serves a file ONLY if the public_notes view (approved + public) lists it.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new NextResponse("Not found", { status: 404 });
  const { data: pub } = await (await createClient()).from("public_notes").select("id,title").eq("id", id).maybeSingle();
  if (!pub) return new NextResponse("Not found", { status: 404 });
  const { data: doc } = await createAdminClient().from("documents").select("storage_path")
    .eq("id", id).eq("visibility", "public").eq("moderation_status", "approved").maybeSingle(); // re-check at the source of truth
  if (!doc) return new NextResponse("Not found", { status: 404 });
  return servePdf(doc.storage_path, pub.title, req.nextUrl.searchParams.get("download") === "1", "public");
}
