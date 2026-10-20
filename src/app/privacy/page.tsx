import { SiteFooter, SiteHeader } from "@/components/site-header";
import { env } from "@/lib/env";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({ title: "Privacy Policy", description: "What EduSathi collects, who can see it, how it is protected and how you can delete it.", path: "/privacy" });
const ADS = Boolean(process.env.NEXT_PUBLIC_ADSENSE_CLIENT);

export default function Page() {
  return (<><SiteHeader /><main id="main" className="prose-page">
    <h1>Privacy Policy</h1>
    <p className="text-sm text-muted">Last updated: 20 October 2026</p>
    <p>This policy explains what EduSathi collects, why, who can see it, and the choices you have. We collect only what we need to run a study platform for students.</p>

    <h2>What we collect</h2>
    <ul>
      <li><strong>Account:</strong> your email address (used to sign in and, when enabled, to send verification and reset emails; never shown to other users) and a password that we store only as a salted hash.</li>
      <li><strong>Profile:</strong> your display name and optional details you choose to add: username, bio, photo, college, program, semester and language.</li>
      <li><strong>Content:</strong> groups you create, files you upload, discussions, questions, chat messages, saved notes and reports you submit.</li>
      <li><strong>Technical data:</strong> your IP address and browser type, used for security, abuse prevention (rate limiting), de-duplicated view and download counts on public notes, and error diagnosis. Our server logs are kept for a limited time.</li>
    </ul>

    <h2>Who can see your content</h2>
    <ul>
      <li>Files, discussions, questions, calendar events and chat in a group are visible only to that group&apos;s members. Private groups are hidden from search.</li>
      <li>Direct messages are visible only to the two people in the conversation. Administrators cannot read direct messages. For safety, administrators can review group chats and content that is reported.</li>
      <li>A file becomes public only if its uploader requests it and a reviewer approves it. Public notes show the uploader&apos;s display name, never their email.</li>
      <li>Public group pages show the group&apos;s name, description, college and member count, but none of its content.</li>
    </ul>

    <h2>Cookies</h2>
    <p>We use one essential cookie that keeps you signed in. It is HttpOnly (not readable by scripts) and is deleted when you log out or after 30 days. It is not used for tracking.</p>
    {ADS ? (<>
      <h2>Advertising</h2>
      <p>Public pages (such as guides, public notes and college pages) may show ads served by Google AdSense. Ad cookies and scripts are loaded <strong>only after you accept</strong> them in the notice shown on those pages, and you can decline. Google and its partners may use cookies to show and measure ads; see <a href="https://policies.google.com/technologies/ads" rel="noopener noreferrer">how Google uses data from sites that use its services</a> and manage your choices at <a href="https://adssettings.google.com" rel="noopener noreferrer">Google Ad Settings</a>. Ads are never shown inside groups, chats or private files, and your private content is never used to choose ads.</p>
    </>) : (<p>We do not currently show third-party advertising. If we start, we will update this policy, ask for your consent before loading any advertising cookies, and never show ads inside groups, chats or private files.</p>)}

    <h2>How we use your data</h2>
    <p>To provide the service (sign-in, groups, files, chat, notifications and reminders), to keep it safe (moderation, abuse prevention, security logs), and to improve it (aggregate, de-duplicated counts such as note downloads). We do not sell your personal data.</p>

    <h2>Security</h2>
    <p>Passwords are hashed, sessions use HttpOnly cookies, access to private data is enforced by database-level row security as well as in the application, traffic is encrypted with HTTPS, and the database is backed up regularly. No system is perfectly secure; please use a strong, unique password and tell us if you notice a problem.</p>

    <h2>Retention and your choices</h2>
    <ul>
      <li>You can edit your profile and delete your own content at any time.</li>
      <li>You can request deletion of your account and data from <strong>Settings</strong>. An administrator removes your profile, uploads, posts and messages. Copies in backups are removed as backups expire.</li>
      <li>Content you reported or that was reported may be kept for a limited time to handle the report.</li>
    </ul>

    <h2>Children</h2>
    <p>EduSathi is intended for students. It is not directed at children under 13, and we do not knowingly collect their data. If you believe a child has signed up, contact us and we will remove the account.</p>

    <h2>Changes and contact</h2>
    <p>We may update this policy; the date above shows the latest version. {env.contactEmail ? <>Questions about privacy: <a href={`mailto:${env.contactEmail}`}>{env.contactEmail}</a>.</> : <>Questions about privacy can be sent through the <a href="/contact">contact page</a>.</>}</p>
  </main><SiteFooter /></>);
}
