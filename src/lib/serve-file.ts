import "server-only";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/** Streams a private-bucket object. Callers MUST have authorised access first. */
export async function servePdf(storagePath: string, filename: string, download: boolean, cache: "public" | "private") {
  const { data, error } = await createAdminClient().storage.from("documents").download(storagePath);
  if (error || !data) return new NextResponse("Not found", { status: 404 });
  const safe = filename.replace(/[^\w\- ]+/g, "").trim().slice(0, 80) || "document";
  return new NextResponse(data.stream(), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${safe}.pdf"`,
      "Cache-Control": cache === "public" ? "public, max-age=300" : "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "sandbox",
    },
  });
}
