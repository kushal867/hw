import type { NextRequest } from "next/server";

/** Public origin of the request. Behind nginx the app sees an internal address, so trust the proxy headers instead. */
export function requestOrigin(req: NextRequest) {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!host || !/^[\w.-]+(:\d+)?$/.test(host)) return req.nextUrl.origin;
  const proto = req.headers.get("x-forwarded-proto")?.split(",")[0] === "https" ? "https" : "http";
  return `${proto}://${host}`;
}
