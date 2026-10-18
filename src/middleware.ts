import { NextResponse, type NextRequest } from "next/server";
import { requestOrigin } from "@/lib/origin";

const PRIVATE = ["/dashboard", "/profile", "/settings", "/notifications", "/my-groups", "/groups", "/subjects", "/pdf-maker", "/admin", "/moderator"];

/** Cheap gate: private areas need a session cookie. The cookie is fully validated against the database on the server. */
export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isPrivate = PRIVATE.some((p) => path === p || path.startsWith(p + "/"));
  if (isPrivate && !request.cookies.get("es_session")) {
    return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(path)}`, requestOrigin(request)));
  }
  return NextResponse.next();
}
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)"] };
