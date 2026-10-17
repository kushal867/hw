import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { Field } from "@/components/ui/misc";
import { requestPasswordReset } from "@/app/actions/auth";

export const metadata = { title: "Reset password" };

export default function Page() {
  return (
    <AuthShell title="Reset your password" sub="We'll email you a link to choose a new one.">
      <ActionForm action={requestPasswordReset} className="space-y-4">
        <Field label="Email" name="email" type="email" autoComplete="email" required />
        <SubmitButton className="w-full">Send Reset Link</SubmitButton>
      </ActionForm>
      <p className="mt-4 text-center text-sm"><Link className="text-brand-700 hover:underline" href="/login">Back to log in</Link></p>
    </AuthShell>
  );
}
