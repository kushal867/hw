import { AuthShell } from "@/components/auth-shell";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { Field } from "@/components/ui/misc";
import { updatePassword } from "@/app/actions/auth";
import { requireUser } from "@/lib/auth";

export const metadata = { title: "Choose a new password" };

export default async function Page() {
  await requireUser(); // reached only through the emailed recovery link, which creates a session
  return (
    <AuthShell title="Choose a new password" sub="Use at least 8 characters.">
      <ActionForm action={updatePassword} className="space-y-4">
        <Field label="New password" name="password" type="password" autoComplete="new-password" required minLength={8} />
        <SubmitButton className="w-full">Update Password</SubmitButton>
      </ActionForm>
    </AuthShell>
  );
}
