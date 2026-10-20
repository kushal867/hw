import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

// Home-screen icons referenced by the web app manifest (192 and 512 px only).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ size: string }> }) {
  const { size } = await params;
  const px = size === "512" ? 512 : size === "192" ? 192 : 0;
  if (!px) return new Response("Not found", { status: 404 });
  return new ImageResponse(
    (<div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg,#4f46e5,#7c3aed)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: Math.round(px * 0.6), fontWeight: 800 }}>E</div>),
    { width: px, height: px, headers: { "Cache-Control": "public, max-age=604800, immutable" } });
}
