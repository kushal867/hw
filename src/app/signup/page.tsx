import Link from "next/link";
import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { Field } from "@/components/ui/misc";
import { signUp } from "@/app/actions/auth";

export const metadata: Metadata = { title: "Join EduSathi" };

export default function SignupPage() {
  return (
    <AuthShell title="Join EduSathi — it's free" sub="Create your account to join or create study groups.">
      <ActionForm action={signUp} className="space-y-5">
        <Field label="Display name" name="name" autoComplete="name" required minLength={2} maxLength={60} hint="Shown to classmates. You can use your first name or a nickname." />
        <Field label="Email" name="email" type="email" autoComplete="email" required hint="Never shown publicly." />
        <Field label="Password" name="password" type="password" autoComplete="new-password" required minLength={8} />
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="agree" className="mt-1" required />
          <span>I agree to the <Link href="/terms" className="text-brand-700 underline">Terms</Link> and <Link href="/privacy" className="text-brand-700 underline">Privacy Policy</Link>.</span></label>
        <SubmitButton className="btn-lg w-full">Create account</SubmitButton>
      </ActionForm>
      <p className="mt-6 text-center text-sm text-muted">Already have an account? <Link className="font-semibold text-brand-700 underline underline-offset-2" href="/login">Log in</Link></p>
    </AuthShell>
  );
}
