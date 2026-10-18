import { SiteFooter, SiteHeader } from "@/components/site-header";
export const metadata = { title: "Terms of Service" };
export default function Page() {
  return (<><SiteHeader /><main id="main" className="prose-page">
    <h1>Terms of Service</h1>
    <p className="rounded-control bg-warn/10 p-3 text-sm">Draft for the pilot launch — have this reviewed by a qualified professional before public launch.</p>
    <p>EduSathi is free to use. Upload only material you created or have permission to share. Do not post harassment, spam, or infringing content. We may remove content or restrict accounts that break these rules.</p>
    <p>Predicted exam questions are study aids and are never guaranteed to appear in any exam.</p>
  </main><SiteFooter /></>);
}
