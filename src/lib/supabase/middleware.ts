import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { env, isConfigured } from "@/lib/env";

const PRIVATE = ["/dashboard", "/profile", "/settings", "/notifications", "/my-groups", "/groups", "/subjects", "/pdf-maker", "/admin", "/moderator"];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const path = request.nextUrl.pathname;
  const isPrivate = PRIVATE.some((p) => path === p || path.startsWith(p + "/"));
  if (!isConfigured()) { // no backend yet: private areas bounce to /login (which explains the missing config)
    if (!isPrivate) return response;
    const url = request.nextUrl.clone(); url.pathname = "/login"; url.search = ""; return NextResponse.redirect(url);
  }
  const supabase = createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(list) {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const { data: { user } } = await supabase.auth.getUser(); // validates the JWT with Supabase (not just the cookie)
  if (!user && isPrivate) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(path)}`;
    return NextResponse.redirect(url);
  }
  return response;
}
