import Link from "next/link";
import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { Field } from "@/components/ui/misc";
import { logIn } from "@/app/actions/auth";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  return (
    <AuthShell title="Welcome back" sub="Log in to your groups, files and discussions.">
      {error && <p role="alert" className="mb-4 rounded-control bg-danger/5 p-3 text-sm text-danger">That link is invalid or has expired. Please try again.</p>}
      <ActionForm action={logIn} className="space-y-5">
        <input type="hidden" name="next" value={next ?? ""} />
        <Field label="Email" name="email" type="email" autoComplete="email" required />
        <Field label="Password" name="password" type="password" autoComplete="current-password" required />
        <SubmitButton className="btn-lg w-full">Log In</SubmitButton>
      </ActionForm>
      <div className="mt-6 flex justify-between text-sm font-semibold">
        <Link className="text-brand-700 hover:underline" href="/forgot-password">Forgot password?</Link>
        <Link className="text-brand-700 hover:underline" href="/signup">Create account</Link>
      </div>
    </AuthShell>
  );
}
