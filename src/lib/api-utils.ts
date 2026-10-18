/** Pure helpers for API routes (no server-only imports, so they are unit-testable). */
import { createHash } from "crypto";

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public headers?: Record<string, string>) { super(message); }
}

/** First client IP behind a proxy (nginx sets x-forwarded-for). Used only for rate-limit keys, never for authorisation. */
export function ipFrom(h: { get(name: string): string | null }) {
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  return ip.slice(0, 64);
}

/** Stable UUID-shaped key for rate limiting on non-user things (IP, email, room…). The rate_limits table keys on uuid. */
export function keyId(s: string) {
  const h = createHash("sha256").update(s).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

/**
 * CSRF defence for cookie-authenticated, state-changing requests: the browser must say the request came from our own site.
 * Accepts a matching Origin, or Sec-Fetch-Site: same-origin. Anything else (cross-site pages, bare scripts) is refused.
 */
export function isSameOrigin(h: { get(name: string): string | null }) {
  const origin = h.get("origin");
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (origin) { try { return !!host && new URL(origin).host === host; } catch { return false; } }
  return h.get("sec-fetch-site") === "same-origin";
}

/** Map a database error to an HTTP status + a message that is safe to show. Unknown errors never leak details. */
export function mapDbError(e: { code?: string; message?: string }): ApiError {
  const msg = e.message ?? "";
  switch (e.code) {
    case "23505": return new ApiError(409, "conflict", "That already exists.");
    case "23503": return new ApiError(404, "not_found", "Not found.");
    case "23514": case "22023": case "22001": return new ApiError(400, "invalid", /empty|reply target/.test(msg) ? msg.charAt(0).toUpperCase() + msg.slice(1) + "." : "That isn't allowed.");
    case "PGRST116": return new ApiError(404, "not_found", "Not found.");
    case "42501":
      if (/edit window/.test(msg)) return new ApiError(403, "edit_window", "You can only edit a message within 24 hours.");
      if (/only the author/.test(msg)) return new ApiError(403, "forbidden", "Only the author can edit this message.");
      if (/share a group|blocked|cannot message|restricted/.test(msg)) return new ApiError(403, "forbidden", /share a group/.test(msg) ? "You can only message people who share a group with you." : "You can't message this person.");
      return new ApiError(403, "forbidden", "You don't have permission to do that.");
    case "57014": return new ApiError(503, "timeout", "The server is busy. Please try again.");
    default: return new ApiError(500, "internal", "Something went wrong. Please try again.");
  }
}
