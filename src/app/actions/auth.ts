"use server";
import { createHash } from "crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { adminSql } from "@/lib/db";
import { env } from "@/lib/env";
import { mailEnabled, sendMail } from "@/lib/mailer";
import { hashPassword, verifyPassword } from "@/lib/passwords";
import { safeNext } from "@/lib/redirect";
import { allow } from "@/lib/security";
import { createSession, destroyOtherSessions, destroySession, issueToken } from "@/lib/session";
import { getSessionUser } from "@/lib/session";
import type { ActionResult } from "@/components/ui/action-form";

const email = z.string().trim().toLowerCase().email("Enter a valid email address.");
const password = z.string().min(8, "Password must be at least 8 characters.").max(72);

/** Stable UUID derived from arbitrary text, so the per-user rate limiter can also key on IP / email. */
const keyId = (s: string) => { const h = createHash("md5").update(s).digest("hex"); return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`; };
const clientIp = async () => (await headers()).get("x-forwarded-for")?.split(",")[0].trim() || "unknown";

export async function signUp(fd: FormData): Promise<ActionResult> {
  const p = z.object({ name: z.string().trim().min(2, "Enter your name.").max(60), email, password, agree: z.literal("on", "Please accept the Terms and Privacy Policy.") })
    .safeParse({ name: fd.get("name"), email: fd.get("email"), password: fd.get("password"), agree: fd.get("agree") });
  if (!p.success) return { ok: false, message: p.error.issues[0].message };
  if (!(await allow(keyId(`signup:${await clientIp()}`), "signup", 10, 3600))) return { ok: false, message: "Too many sign-ups from your network. Try again later." };

  const verifyByEmail = mailEnabled();
  const existing = await adminSql("select 1 from auth.users where lower(email) = $1", [p.data.email]);
  if (existing.length) {
    return verifyByEmail ? { ok: true, message: "Check your email to verify your account, then log in." } // same answer: no account enumeration
                         : { ok: false, message: "An account with this email already exists. Please log in." };
  }
  let userId: string;
  try {
    const rows = await adminSql<{ id: string }>(
      `insert into auth.users (email, password_hash, raw_user_meta_data, email_verified_at)
       values ($1, $2, jsonb_build_object('display_name', $3::text), case when $4 then null else now() end) returning id`,
      [p.data.email, await hashPassword(p.data.password), p.data.name, verifyByEmail]);
    userId = rows[0].id;
  } catch (e: any) {
    if (e?.code === "23505") return { ok: false, message: "An account with this email already exists. Please log in." };
    return { ok: false, message: "Could not create your account. Please try again." };
  }
  if (!verifyByEmail) { await createSession(userId); return { ok: true, redirect: "/dashboard", message: "Welcome to EduSathi!" }; }
  const token = await issueToken(userId, "verify_email", 60 * 24);
  await sendMail(p.data.email, "Verify your EduSathi account", `Welcome to EduSathi!\n\nConfirm your email to activate your account:\n${env.siteUrl}/auth/callback?type=verify&token=${token}\n\nThis link expires in 24 hours. If you didn't sign up, ignore this email.`);
  return { ok: true, message: "Check your email to verify your account, then log in." };
}

export async function logIn(fd: FormData): Promise<ActionResult> {
  const p = z.object({ email, password: z.string().min(1, "Enter your password.") }).safeParse({ email: fd.get("email"), password: fd.get("password") });
  if (!p.success) return { ok: false, message: p.error.issues[0].message };
  if (!(await allow(keyId(`login:ip:${await clientIp()}`), "login", 40, 600)) || !(await allow(keyId(`login:email:${p.data.email}`), "login", 8, 600)))
    return { ok: false, message: "Too many attempts. Please wait a few minutes." };
  const [u] = await adminSql<{ id: string; password_hash: string | null; email_verified_at: string | null }>(
    "select id, password_hash, email_verified_at from auth.users where lower(email) = $1", [p.data.email]);
  const valid = await verifyPassword(p.data.password, u?.password_hash);
  if (!u || !valid) return { ok: false, message: "Incorrect email or password." };
  if (!u.email_verified_at) return { ok: false, message: "Please verify your email first." };
  await createSession(u.id);
  return { ok: true, redirect: safeNext(fd.get("next")) };
}

export async function logOut() {
  await destroySession();
  redirect("/");
}

export async function requestPasswordReset(fd: FormData): Promise<ActionResult> {
  const p = email.safeParse(fd.get("email"));
  if (!p.success) return { ok: false, message: p.error.issues[0].message };
  if (!(await allow(keyId(`reset:ip:${await clientIp()}`), "reset", 10, 3600))) return { ok: false, message: "Too many requests. Try again later." };
  const [u] = await adminSql<{ id: string }>("select id from auth.users where lower(email) = $1", [p.data]);
  if (u) {
    const token = await issueToken(u.id, "reset_password", 60);
    const link = `${env.siteUrl}/auth/callback?type=recovery&token=${token}`;
    if (mailEnabled()) await sendMail(p.data, "Reset your EduSathi password", `Use this link to choose a new password:\n${link}\n\nIt expires in 1 hour. If you didn't ask for this, ignore this email.`);
    else console.warn(`[mail disabled] password reset link for ${p.data}: ${link}`);
  }
  return { ok: true, message: "If that email has an account, a reset link is on its way." }; // same answer either way
}

export async function updatePassword(fd: FormData): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, message: "Please log in again." };
  const p = password.safeParse(fd.get("password"));
  if (!p.success) return { ok: false, message: p.error.issues[0].message };
  await adminSql("update auth.users set password_hash = $2 where id = $1", [user.id, await hashPassword(p.data)]);
  await destroyOtherSessions(user.id);
  return { ok: true, redirect: "/dashboard", message: "Password updated." };
}
