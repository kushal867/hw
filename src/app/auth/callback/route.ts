import { NextResponse, type NextRequest } from "next/server";
import { adminSql } from "@/lib/db";
import { requestOrigin } from "@/lib/origin";
import { safeNext } from "@/lib/redirect";
import { consumeToken, createSession } from "@/lib/session";

/** Emailed links land here: verifies the one-time token, signs the user in, and sends them on. */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const token = q.get("token") ?? "";
  const type = q.get("type");
  const fail = () => NextResponse.redirect(new URL("/login?error=link", requestOrigin(request)));
  if (type !== "verify" && type !== "recovery") return fail();
  const userId = await consumeToken(token, type === "verify" ? "verify_email" : "reset_password");
  if (!userId) return fail();
  if (type === "verify") await adminSql("update auth.users set email_verified_at = coalesce(email_verified_at, now()) where id = $1", [userId]);
  await createSession(userId);
  return NextResponse.redirect(new URL(type === "recovery" ? "/reset-password" : safeNext(q.get("next")), requestOrigin(request)));
}
