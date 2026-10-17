import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { env, isConfigured } from "@/lib/env";

const PRIVATE = ["/dashboard", "/profile", "/settings", "/notifications", "/my-semesters", "/semesters", "/subjects", "/pdf-maker", "/admin", "/moderator"];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  if (!isConfigured()) return response;
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
  const path = request.nextUrl.pathname;
  if (!user && PRIVATE.some((p) => path === p || path.startsWith(p + "/"))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(path)}`;
    return NextResponse.redirect(url);
  }
  return response;
}
