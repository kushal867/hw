import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { env } from "@/lib/env";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({ title: "Contact EduSathi", description: "How to reach EduSathi for help, feedback, missing colleges and programs, and takedown requests.", path: "/contact" });

export default function Page() {
  return (<><SiteHeader /><main id="main" className="prose-page">
    <h1>Contact</h1>
    {env.contactEmail
      ? <p>For help, feedback or business questions, email <a href={`mailto:${env.contactEmail}`}>{env.contactEmail}</a>.</p>
      : <p>For help or feedback, log in and use the reporting form below. We read every report.</p>}
    <h2>Report content or request a takedown</h2>
    <p>If something on EduSathi breaks the rules, contains personal information, or infringes your copyright, use <Link href="/report-content">Content Reporting</Link>. Please include a link to the content and, for copyright, who owns it and why it should be removed. Reports are reviewed by moderators and administrators, and content that is found to break the rules is removed.</p>
    <h2>Add or correct a college, program or subject</h2>
    <p>Colleges, programs and subject lists are maintained by administrators. If yours is missing or wrong, tell us through Content Reporting (choose “Other”) with the official name and the correct details.</p>
    <h2>Delete your account</h2>
    <p>You can request deletion of your account and data from <strong>Settings</strong> after logging in.</p>
  </main><SiteFooter /></>);
}
