import { NextResponse, type NextRequest } from "next/server";
import { IMAGE_MIME } from "@/lib/images";
import { openFile } from "@/lib/storage";

// College photos are public images stored under <college_id>/<timestamp>.<ext>; every upload gets a new name, so they cache forever.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const key = (await params).path.join("/");
  const m = /^[0-9a-f-]{36}\/\d+\.(png|jpg|webp)$/.exec(key);
  if (!m) return new NextResponse("Not found", { status: 404 });
  const file = await openFile("colleges", key);
  if (!file) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(file.stream, { headers: {
    "Content-Type": IMAGE_MIME[m[1]], "Content-Length": String(file.size), "X-Content-Type-Options": "nosniff",
    "Cache-Control": "public, max-age=31536000, immutable", "Content-Security-Policy": "default-src 'none'",
  } });
}
