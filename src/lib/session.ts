import "server-only";
import { createHash, randomBytes } from "crypto";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import { adminSql } from "@/lib/db";
import { env } from "@/lib/env";

export const SESSION_COOKIE = "es_session";
const SESSION_DAYS = 30;
const sha = (s: string) => createHash("sha256").update(s).digest("hex");

export type SessionUser = { id: string; email: string };

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const ua = ((await headers()).get("user-agent") ?? "").slice(0, 200);
  await adminSql("insert into auth.sessions (user_id, token_hash, expires_at, user_agent) values ($1, $2, now() + $3 * interval '1 day', $4)", [userId, sha(token), SESSION_DAYS, ua]);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true, sameSite: "lax", path: "/", secure: env.siteUrl.startsWith("https://"), maxAge: SESSION_DAYS * 86400,
  });
}

/** The signed-in user, validated against the database (not just the cookie). */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || token.length > 100) return null;
  const rows = await adminSql<SessionUser>(
    "select u.id, u.email from auth.sessions s join auth.users u on u.id = s.user_id where s.token_hash = $1 and s.expires_at > now()", [sha(token)]);
  return rows[0] ?? null;
});

export async function destroySession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await adminSql("delete from auth.sessions where token_hash = $1", [sha(token)]);
  store.delete(SESSION_COOKIE);
}

/** After a password change: sign out everywhere except the current browser. */
export async function destroyOtherSessions(userId: string) {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  await adminSql("delete from auth.sessions where user_id = $1 and token_hash <> $2", [userId, token ? sha(token) : ""]);
}

// ───────── One-time tokens (email verification / password reset) ─────────
export async function issueToken(userId: string, purpose: "verify_email" | "reset_password", minutes: number) {
  const token = randomBytes(32).toString("base64url");
  await adminSql("delete from auth.tokens where user_id = $1 and purpose = $2", [userId, purpose]);
  await adminSql("insert into auth.tokens (user_id, purpose, token_hash, expires_at) values ($1, $2, $3, now() + $4 * interval '1 minute')", [userId, purpose, sha(token), minutes]);
  return token;
}
/** Single use: marks the token used and returns its user, or null if unknown/expired/used. */
export async function consumeToken(token: string, purpose: "verify_email" | "reset_password") {
  if (!/^[\w-]{20,100}$/.test(token)) return null;
  const rows = await adminSql<{ user_id: string }>(
    "update auth.tokens set used_at = now() where token_hash = $1 and purpose = $2 and used_at is null and expires_at > now() returning user_id", [sha(token), purpose]);
  return rows[0]?.user_id ?? null;
}
