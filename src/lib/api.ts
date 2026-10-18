import "server-only";
import { randomUUID } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import type { z } from "zod";
import { getSessionUser, type SessionUser } from "@/lib/session";
import { allow } from "@/lib/security";
import { logger } from "@/lib/log";
import { ApiError, ipFrom, isSameOrigin, keyId, mapDbError } from "@/lib/api-utils";
import type { DbError } from "@/lib/db";

export { ApiError, mapDbError, ipFrom, keyId };

/** Throws a safe ApiError when a database call failed; otherwise returns the data. */
export function unwrap<T>(r: { data: T; error: DbError | null }): T {
  if (r.error) throw mapDbError(r.error);
  return r.data;
}

type Limit = { bucket: string; max: number; windowSeconds: number };
type Opts<B, Q> = {
  /** Require a signed-in user (default true). */
  auth?: boolean;
  body?: z.ZodType<B>;
  query?: z.ZodType<Q>;
  /** Per-user limit (per-IP when the route is public). More than one can be given. */
  limit?: Limit | Limit[];
  maxBodyBytes?: number;
};
export type Ctx<B, Q> = { req: NextRequest; user: SessionUser; params: Record<string, string>; body: B; query: Q; requestId: string; ip: string };

const SAFE = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Wraps a route handler with the protections every API route needs:
 *  request id → same-origin (CSRF) check → session auth → rate limits → body size/JSON/schema validation → safe errors.
 * Unexpected exceptions are logged with the request id and returned as a generic 500 (no internals leak).
 */
export function route<B = undefined, Q = undefined>(opts: Opts<B, Q>, handler: (c: Ctx<B, Q>) => Promise<unknown>) {
  return async (req: NextRequest, ctx: { params: Promise<Record<string, string>> }): Promise<Response> => {
    const requestId = req.headers.get("x-request-id")?.slice(0, 64) || randomUUID();
    const started = Date.now();
    const respond = (status: number, payload: unknown, headers: Record<string, string> = {}) =>
      NextResponse.json(payload, { status, headers: { "x-request-id": requestId, "cache-control": "no-store", ...headers } });
    const fail = (e: ApiError) => respond(e.status, { error: { code: e.code, message: e.message }, requestId }, e.headers);
    let userId: string | null = null;
    try {
      if (!SAFE.has(req.method) && !isSameOrigin(req.headers)) throw new ApiError(403, "bad_origin", "Cross-site requests are not allowed.");

      const user = opts.auth === false ? null : await getSessionUser();
      if (opts.auth !== false && !user) throw new ApiError(401, "unauthenticated", "Please log in.");
      userId = user?.id ?? null;
      const ip = ipFrom(req.headers);

      for (const l of opts.limit ? ([] as Limit[]).concat(opts.limit) : []) {
        if (!(await allow(user ? user.id : keyId(`ip:${ip}`), l.bucket, l.max, l.windowSeconds)))
          throw new ApiError(429, "rate_limited", "You're doing that too fast. Please slow down.", { "retry-after": String(Math.min(l.windowSeconds, 60)) });
      }

      let body = undefined as B;
      if (opts.body) {
        const raw = await req.text();
        if (Buffer.byteLength(raw) > (opts.maxBodyBytes ?? 16 * 1024)) throw new ApiError(413, "too_large", "That request is too large.");
        let json: unknown;
        try { json = raw ? JSON.parse(raw) : {}; } catch { throw new ApiError(400, "invalid_json", "Invalid request."); }
        const p = opts.body.safeParse(json);
        if (!p.success) throw new ApiError(400, "invalid", p.error.issues[0]?.message || "Invalid request.");
        body = p.data;
      }
      let query = undefined as Q;
      if (opts.query) {
        const p = opts.query.safeParse(Object.fromEntries(req.nextUrl.searchParams));
        if (!p.success) throw new ApiError(400, "invalid", p.error.issues[0]?.message || "Invalid request.");
        query = p.data;
      }

      const result = await handler({ req, user: user as SessionUser, params: await ctx.params, body, query, requestId, ip });
      if (result instanceof Response) { result.headers.set("x-request-id", requestId); return result; }
      return respond(result === undefined ? 204 : 200, result === undefined ? null : result);
    } catch (e) {
      if (e instanceof ApiError) return fail(e);
      logger.error("api.unhandled", { requestId, method: req.method, path: req.nextUrl.pathname, user: userId, error: e });
      return fail(new ApiError(500, "internal", "Something went wrong. Please try again."));
    } finally {
      const ms = Date.now() - started;
      if (ms > 1000) logger.warn("api.slow", { requestId, method: req.method, path: req.nextUrl.pathname, ms });
    }
  };
}
