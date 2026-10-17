import "server-only";
import { NextResponse } from "next/server";
import { openFile } from "@/lib/storage";

/** Streams a stored PDF. Callers MUST have authorised access first. */
export async function servePdf(storagePath: string, filename: string, download: boolean, cache: "public" | "private") {
  const file = await openFile("documents", storagePath);
  if (!file) return new NextResponse("Not found", { status: 404 });
  const safe = filename.replace(/[^\w\- ]+/g, "").trim().slice(0, 80) || "document";
  return new NextResponse(file.stream, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(file.size),
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${safe}.pdf"`,
      "Cache-Control": cache === "public" ? "public, max-age=300" : "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "sandbox",
    },
  });
}
