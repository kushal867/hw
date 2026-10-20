import { SiteFooter, SiteHeader } from "@/components/site-header";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({ title: "Terms of Service", description: "The rules for using EduSathi: accounts, content, acceptable use, copyright and moderation.", path: "/terms" });

export default function Page() {
  return (<><SiteHeader /><main id="main" className="prose-page">
    <h1>Terms of Service</h1>
    <p className="text-sm text-muted">Last updated: 20 October 2026</p>
    <p>By creating an account or using EduSathi you agree to these terms. If you do not agree, please do not use the service.</p>

    <h2>1. Who can use EduSathi</h2>
    <p>EduSathi is for students and learners. You must provide accurate account information and keep your password private. You are responsible for activity under your account. You must not use the service if you are under 13.</p>

    <h2>2. Your content</h2>
    <p>You keep ownership of what you post. By uploading or posting, you give EduSathi permission to store, display and deliver it to the audience you choose (your group, or the public if a file is approved for publication) so that the service can work. Only share material you wrote or have the right to share. Do not upload textbooks, paid material or other people&apos;s work without permission.</p>

    <h2>3. Acceptable use</h2>
    <p>You agree not to:</p>
    <ul>
      <li>post unlawful, harassing, hateful, sexually explicit or threatening content, or spam;</li>
      <li>share personal information about others, or impersonate anyone;</li>
      <li>upload malware, scripts or files that are not what they claim to be;</li>
      <li>cheat: do not publish graded homework, assignments or lab reports, and do not use the service to break your institution&apos;s academic integrity rules;</li>
      <li>try to access other people&apos;s data, bypass limits, scrape the service or disrupt it.</li>
    </ul>

    <h2>4. Groups, moderation and public notes</h2>
    <p>Group owners and moderators can approve or remove members and hide content in their group. Administrators can review reported content and group chats, and can restrict or remove accounts and content that break these terms. Public notes are reviewed before publication, and a published note can be removed at any time.</p>

    <h2>5. Copyright and takedowns</h2>
    <p>If you believe content on EduSathi infringes your rights, use <a href="/report-content">Content Reporting</a> and identify the content and why it should be removed. We review reports and remove content that infringes or breaks these terms. Repeat infringers may lose their accounts.</p>

    <h2>6. Availability and changes</h2>
    <p>EduSathi is provided free and “as is”. We try to keep it available and your data safe, but we cannot guarantee uninterrupted service or that content will never be lost, so keep your own copies of important files. We may change or discontinue features, and we may update these terms; continued use after a change means you accept it.</p>

    <h2>7. Ending your account</h2>
    <p>You can delete your account from Settings at any time. We may suspend or remove accounts that break these terms or put others at risk.</p>

    <h2>8. Liability and law</h2>
    <p>To the extent allowed by law, EduSathi is not liable for indirect or consequential losses arising from use of the service, or for content posted by users. Study materials are shared by students and are not official; check them against your syllabus and teachers&apos; instructions. These terms are governed by the laws of Nepal.</p>

    <h2>9. Contact</h2>
    <p>Questions about these terms: see the <a href="/contact">contact page</a>.</p>
  </main><SiteFooter /></>);
}
