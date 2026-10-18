import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { getCurrentUser } from "@/lib/auth";
import { submitReport } from "@/app/actions/account";

export const metadata = { title: "Report content" };

export default async function ReportPage({ searchParams }: { searchParams: Promise<{ type?: string; id?: string }> }) {
  const sp = await searchParams;
  const me = await getCurrentUser();
  if (!me) redirect(`/login?next=${encodeURIComponent(`/report-content${sp.id ? `?type=${sp.type}&id=${sp.id}` : ""}`)}`);
  return (<><SiteHeader /><main id="main" className="mx-auto max-w-xl px-4 py-12">
    <h1 className="text-2xl font-bold">Report content</h1>
    <p className="mb-6 mt-1 text-sm text-muted">Tell us about spam, inappropriate material or content that infringes your copyright. Choose &ldquo;Copyright complaint&rdquo; and describe the work and where it appears.</p>
    <ActionForm action={submitReport} className="card space-y-4 p-5">
      <div><label htmlFor="type" className="label">What are you reporting?</label>
        <select id="type" name="type" defaultValue={sp.type ?? ""} required className="input"><option value="" disabled>Choose…</option><option value="document">A PDF</option><option value="post">A discussion post</option><option value="comment">A reply</option><option value="question">An exam question</option><option value="chat_message">A chat message</option><option value="copyright">Copyright complaint</option></select></div>
      <div><label htmlFor="id" className="label">Content ID</label><input id="id" name="id" defaultValue={sp.id ?? ""} required className="input" placeholder="Filled automatically when you use the Report button" /></div>
      <div><label htmlFor="reason" className="label">Reason</label>
        <select id="reason" name="reason" required defaultValue="" className="input"><option value="" disabled>Choose…</option><option value="spam">Spam</option><option value="inappropriate">Inappropriate</option><option value="copyright">Copyright</option><option value="harassment">Harassment</option><option value="wrong_info">Wrong information</option><option value="other">Other</option></select></div>
      <div><label htmlFor="details" className="label">Details</label><textarea id="details" name="details" rows={4} maxLength={1000} className="input" /></div>
      <SubmitButton>Submit report</SubmitButton>
    </ActionForm>
    <p className="mt-4 text-sm text-muted">Your report is visible only to moderators. See also the <Link className="underline" href="/terms">Terms</Link>.</p>
  </main><SiteFooter /></>);
}
