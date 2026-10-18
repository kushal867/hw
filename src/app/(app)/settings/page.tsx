import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { PageHeader } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { logOut, updatePassword } from "@/app/actions/auth";
import { requestDeletion } from "@/app/actions/account";

export const metadata = { title: "Settings" };

export default async function Settings() {
  const { user } = await requireUser();
  const { data: pending } = await (await createClient()).from("deletion_requests").select("id").eq("user_id", user.id).eq("status", "open").maybeSingle();
  return (
    <>
      <PageHeader title="Settings" />
      <div className="max-w-xl space-y-6">
        <section className="card p-5"><h2 className="mb-1 font-semibold">Account</h2><p className="text-sm text-muted">Signed in as {user.email}</p>
          <p className="mt-2 text-sm">Edit your name, photo and language on your <Link className="text-brand-700 underline" href="/profile">profile</Link>.</p></section>
        <section className="card p-5"><h2 className="mb-3 font-semibold">Change password</h2>
          <ActionForm action={updatePassword} className="space-y-3"><div><label htmlFor="password" className="label">New password</label><input id="password" name="password" type="password" minLength={8} required autoComplete="new-password" className="input" /></div><SubmitButton>Update password</SubmitButton></ActionForm></section>
        <section className="card p-5"><h2 className="mb-1 font-semibold">Session</h2><form action={logOut}><button className="btn-secondary mt-2">Log out</button></form></section>
        <section className="card border-danger/30 p-5"><h2 className="mb-1 font-semibold text-danger">Delete my account and data</h2>
          <p className="mb-3 text-sm text-muted">An administrator will delete your profile, uploads and posts. If you own a group you must transfer ownership first.</p>
          {pending ? <p className="text-sm">Your deletion request is pending.</p> : <ActionForm action={requestDeletion} confirm="Request permanent deletion of your account and data?"><SubmitButton variant="danger">Request deletion</SubmitButton></ActionForm>}</section>
      </div>
    </>);
}
