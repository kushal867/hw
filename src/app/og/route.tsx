import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

/** Social-share card: /og?title=…&sub=… (the title is clipped, so arbitrary query strings can't produce huge images). */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const title = (q.get("title") ?? "EduSathi").slice(0, 90);
  const sub = (q.get("sub") ?? "Free study groups, notes and exam prep for students in Nepal").slice(0, 120);
  const size = title.length > 60 ? 54 : title.length > 36 ? 64 : 76;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, color: "white",
        background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 60%, #db2777 120%)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ width: 64, height: 64, borderRadius: 18, background: "rgba(255,255,255,0.18)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 38, fontWeight: 800 }}>E</div>
          <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: -1 }}>EduSathi</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: size, fontWeight: 800, lineHeight: 1.08, letterSpacing: -2 }}>{title}</div>
          <div style={{ fontSize: 30, opacity: 0.88 }}>{sub}</div>
        </div>
      </div>
    ),
    { width: 1200, height: 630, headers: { "Cache-Control": "public, max-age=86400, s-maxage=86400" } },
  );
}
