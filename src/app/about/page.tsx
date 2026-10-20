import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({ title: "About EduSathi", description: "EduSathi is a free platform where students in Nepal form study groups, share notes, ask questions and prepare for exams together.", path: "/about" });

export default function About() {
  return (<><SiteHeader /><main id="main" className="prose-page">
    <h1>About EduSathi</h1>
    <p>EduSathi (“study friend”) is a free place for students in Nepal to study together. Instead of notes, past papers and questions being scattered across chat apps, a class can keep them in one organised group, with a calendar of exams and deadlines and a chat for quick questions.</p>
    <h2>What you can do</h2>
    <ul>
      <li><strong>Study groups.</strong> Any student can create a group for a class, homework sharing or a study circle. Groups can be public (discoverable) or private (invitation link or QR code only), and can be linked to a college, program and semester.</li>
      <li><strong>Shared files.</strong> Upload PDFs to your group, organised by category and subject. Only members can read them. If you want to help the wider community, you can request that a note be published; a reviewer approves it before it appears in the public library.</li>
      <li><strong>Discussions and chat.</strong> Ask questions that stay searchable, or chat in real time with your group or classmates.</li>
      <li><strong>Exam questions and calendar.</strong> Build a bank of practice and previous-exam questions per subject, and keep exams and assignment deadlines where everyone sees them, with reminders.</li>
      <li><strong>Public library and guides.</strong> Browse approved public notes by college, program, semester and subject, and read our <Link href="/guides">study guides</Link>.</li>
    </ul>
    <h2>How we keep it safe</h2>
    <p>Private files, discussions and chats are visible only to group members, and this is enforced in the database itself, not just in the interface. Homework, assignments and lab reports can never be published publicly. Every public note is reviewed first. Anyone can report content, and moderators and administrators act on reports. Read how we handle your data in the <Link href="/privacy">Privacy Policy</Link>.</p>
    <h2>Who is behind it</h2>
    <p>EduSathi is an independent project built for students in Nepal and free to use. Colleges listed on the site are shown for information to help students find their classmates; EduSathi is not affiliated with them unless stated otherwise.</p>
    <h2>Get in touch</h2>
    <p>Questions, feedback or a college or program missing from the list? See <Link href="/contact">Contact</Link>.</p>
  </main><SiteFooter /></>);
}
