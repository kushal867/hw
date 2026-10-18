import { SiteFooter, SiteHeader } from "@/components/site-header";
export const metadata = { title: "Contact" };
export default function Page() {
  return (<><SiteHeader /><main id="main" className="prose-page">
    <h1>Contact</h1>
    <p>For help, takedown requests, or questions, use <a className="text-brand-700 underline" href="/report-content">Content Reporting</a>. Operator contact details must be set before launch (see README).</p>
  </main><SiteFooter /></>);
}
