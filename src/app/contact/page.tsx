import { SiteFooter, SiteHeader } from "@/components/site-header";
export const metadata = { title: "Contact" };
export default function Page() {
  return (<><SiteHeader /><main id="main" className="mx-auto max-w-3xl space-y-4 px-4 py-14">
    <h1 className="text-3xl font-bold">Contact</h1>
    <p>For help, takedown requests, or questions, use <a className="text-brand-700 underline" href="/report-content">Content Reporting</a>. Operator contact details must be set before launch (see README).</p>
  </main><SiteFooter /></>);
}
