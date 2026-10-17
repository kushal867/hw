import { SiteFooter, SiteHeader } from "@/components/site-header";
export const metadata = { title: "Privacy Policy" };
export default function Page() {
  return (<><SiteHeader /><main id="main" className="mx-auto max-w-3xl space-y-4 px-4 py-14">
    <h1 className="text-3xl font-bold">Privacy Policy</h1>
    <p className="rounded-control bg-warn/10 p-3 text-sm">Draft for the pilot launch — have this reviewed by a qualified professional before public launch.</p>
    <h2 className="text-xl font-semibold">What we collect</h2><p>Your email address (for sign-in only; never shown to others), your display name, optional profile details, and the content you upload or post.</p>
    <h2 className="text-xl font-semibold">Who can see your content</h2><p>Uploads and discussions are visible only to members of your semester. Files become public only if you request it and the file is approved.</p>
    <h2 className="text-xl font-semibold">Your controls</h2><p>You can edit your profile, delete your own content, and request deletion of your account and data from Settings.</p>
  </main><SiteFooter /></>);
}
