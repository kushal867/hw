"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { safeNext } from "@/lib/redirect";
import type { ActionResult } from "@/components/ui/action-form";

const email = z.string().trim().toLowerCase().email("Enter a valid email address.");
const password = z.string().min(8, "Password must be at least 8 characters.").max(72);


export async function signUp(fd: FormData): Promise<ActionResult> {
  const p = z.object({ name: z.string().trim().min(2, "Enter your name.").max(60), email, password, agree: z.literal("on", "Please accept the Terms and Privacy Policy.") })
    .safeParse({ name: fd.get("name"), email: fd.get("email"), password: fd.get("password"), agree: fd.get("agree") });
  if (!p.success) return { ok: false, message: p.error.issues[0].message };
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: p.data.email, password: p.data.password,
    options: { data: { display_name: p.data.name }, emailRedirectTo: `${env.siteUrl}/auth/callback?next=/dashboard` },
  });
  if (error) return { ok: false, message: error.message };
  if (data.session) return { ok: true, redirect: "/dashboard", message: "Welcome to EduSathi!" };
  return { ok: true, message: "Check your email to verify your account, then log in." };
}

export async function logIn(fd: FormData): Promise<ActionResult> {
  const p = z.object({ email, password: z.string().min(1, "Enter your password.") }).safeParse({ email: fd.get("email"), password: fd.get("password") });
  if (!p.success) return { ok: false, message: p.error.issues[0].message };
  const { error } = await (await createClient()).auth.signInWithPassword(p.data);
  if (error) return { ok: false, message: error.message === "Email not confirmed" ? "Please verify your email first." : "Incorrect email or password." };
  return { ok: true, redirect: safeNext(fd.get("next")) };
}

export async function logOut() {
  await (await createClient()).auth.signOut();
  redirect("/");
}

export async function requestPasswordReset(fd: FormData): Promise<ActionResult> {
  const p = email.safeParse(fd.get("email"));
  if (!p.success) return { ok: false, message: p.error.issues[0].message };
  await (await createClient()).auth.resetPasswordForEmail(p.data, { redirectTo: `${env.siteUrl}/auth/callback?next=/reset-password` });
  return { ok: true, message: "If that email has an account, a reset link is on its way." }; // same answer either way: no account enumeration
}

export async function updatePassword(fd: FormData): Promise<ActionResult> {
  const p = password.safeParse(fd.get("password"));
  if (!p.success) return { ok: false, message: p.error.issues[0].message };
  const { error } = await (await createClient()).auth.updateUser({ password: p.data });
  if (error) return { ok: false, message: error.message };
  return { ok: true, redirect: "/dashboard", message: "Password updated." };
}
