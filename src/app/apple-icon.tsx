import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (<div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg,#4f46e5,#7c3aed)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 110, fontWeight: 800 }}>E</div>),
    size);
}
