import { NextResponse, type NextRequest } from "next/server";
import { openFile } from "@/lib/storage";

const TYPES: Record<string, string> = { png: "image/png", jpg: "image/jpeg", webp: "image/webp" };

// Avatars are public images stored under <user_id>/<timestamp>.<ext>; the name changes on every upload, so they cache forever.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const key = path.join("/");
  const m = /^[0-9a-f-]{36}\/\d+\.(png|jpg|webp)$/.exec(key);
  if (!m) return new NextResponse("Not found", { status: 404 });
  const file = await openFile("avatars", key);
  if (!file) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(file.stream, { headers: {
    "Content-Type": TYPES[m[1]], "Content-Length": String(file.size), "X-Content-Type-Options": "nosniff",
    "Cache-Control": "public, max-age=31536000, immutable", "Content-Security-Policy": "default-src 'none'",
  } });
}
