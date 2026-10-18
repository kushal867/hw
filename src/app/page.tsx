import Link from "next/link";
import { ArrowRight, BookMarked, FileText, FileDown, GraduationCap, MessagesSquare, QrCode, Search, ShieldCheck, Users } from "lucide-react";
import { SiteFooter, SiteHeader } from "@/components/site-header";

const STEPS = [
  { icon: GraduationCap, t: "Create or join a group", d: "Start a group for your class or homework, search public groups, or scan a QR code from a classmate." },
  { icon: FileText, t: "Share and discover PDFs", d: "Upload homework and notes privately to your classmates, or publish approved notes publicly." },
  { icon: MessagesSquare, t: "Learn together", d: "Ask questions, answer classmates, and build a bank of important exam questions." },
];
const FEATURES = [
  { icon: Search, t: "Find your college, course and subjects", d: "Tag a group to your college semester so classmates and subjects line up." },
  { icon: Users, t: "Student-created groups", d: "Anyone can start a group — public or private. Files and discussions stay with its members." },
  { icon: QrCode, t: "Join with a QR code", d: "Owners create expiring, limited-use invitations. Share a link or print the QR." },
  { icon: BookMarked, t: "Important exam questions", d: "Practice and previous-exam questions per subject. Teacher-confirmed is labelled only when verified." },
  { icon: FileDown, t: "Create study PDFs", d: "Turn your own notes and questions into a clean, printable PDF." },
  { icon: ShieldCheck, t: "Moderated and safe", d: "Report content, request takedowns, and public notes are reviewed before they appear." },
];
const FAQ = [
  ["Is EduSathi really free?", "Yes. There are no subscriptions or payments at launch."],
  ["Who can see my uploads?", "Uploads are private to your group by default. Only you can request that a file be published, and it appears publicly only after review."],
  ["Do I need to use my real name?", "No. Choose any display name. Your email is never shown to others."],
  ["Can I share textbooks?", "Only share material you own or have permission to share. Copyright complaints are handled through Content Reporting."],
];

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main id="main">
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-14 md:py-20 lg:grid-cols-2">
          <div>
            <p className="badge mb-4">Free for students in Nepal</p>
            <h1 className="text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">Your Semester. Your Notes. Your Community.</h1>
            <p className="mt-5 max-w-xl text-lg text-muted">Share study materials, discover important exam questions, and learn together with classmates—all in one place.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/signup" className="btn-primary !min-h-[48px] !px-6">Join EduSathi — It&apos;s Free <ArrowRight className="h-4 w-4" aria-hidden /></Link>
              <Link href="/public-notes" className="btn-secondary !min-h-[48px] !px-6">Explore Public Notes</Link>
            </div>
          </div>
          <ProductPreview />
        </section>

        <section className="border-y border-line bg-surface py-16" aria-labelledby="how">
          <div className="mx-auto max-w-6xl px-4">
            <h2 id="how" className="text-2xl font-bold">How EduSathi works</h2>
            <ol className="mt-8 grid gap-6 md:grid-cols-3">
              {STEPS.map((s, i) => (
                <li key={s.t} className="card p-6">
                  <span className="mb-4 flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-control bg-brand-50 text-brand-600"><s.icon className="h-5 w-5" aria-hidden /></span><span className="text-sm font-semibold text-muted">Step {i + 1}</span></span>
                  <h3 className="font-semibold">{s.t}</h3><p className="mt-1 text-sm text-muted">{s.d}</p>
                </li>))}
            </ol>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16" aria-labelledby="feat">
          <h2 id="feat" className="text-2xl font-bold">Everything a study group needs</h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.t} className="card p-6">
                <f.icon className="mb-3 h-5 w-5 text-brand-600" aria-hidden /><h3 className="font-semibold">{f.t}</h3><p className="mt-1 text-sm text-muted">{f.d}</p>
              </div>))}
          </div>
        </section>

        <section className="bg-brand-50 py-16">
          <div className="mx-auto max-w-6xl px-4">
            <h2 className="text-2xl font-bold">Why students use it</h2>
            <ul className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
              {["Everything for your class and homework in one organised place", "Study with classmates instead of searching chat groups for files", "Nepali (Unicode) text supported", "Works on your phone", "Free at launch"].map((b) => <li key={b} className="card px-4 py-3">{b}</li>)}
            </ul>
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-4 py-16" aria-labelledby="faq">
          <h2 id="faq" className="text-2xl font-bold">Frequently asked questions</h2>
          <div className="mt-6 space-y-3">
            {FAQ.map(([q, a]) => (
              <details key={q} className="card group p-4"><summary className="cursor-pointer font-semibold">{q}</summary><p className="mt-2 text-sm text-muted">{a}</p></details>))}
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

/** Illustrative UI mock-up of a group workspace. Contains only generic labels — no invented data. */
function ProductPreview() {
  return (
    <div className="card overflow-hidden shadow-pop" aria-hidden>
      <div className="flex items-center gap-1.5 border-b border-line bg-canvas px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-line" /><span className="h-2.5 w-2.5 rounded-full bg-line" /><span className="h-2.5 w-2.5 rounded-full bg-line" />
        <span className="ml-3 text-xs text-muted">Group workspace · preview</span>
      </div>
      <div className="grid grid-cols-[110px_1fr] sm:grid-cols-[140px_1fr]">
        <div className="space-y-1 border-r border-line p-3 text-xs">
          {["Overview", "Subjects", "Shared PDFs", "Discussions", "Questions", "Members"].map((l, i) => (
            <div key={l} className={`rounded-control px-2.5 py-2 ${i === 2 ? "bg-brand-50 font-semibold text-brand-700" : "text-muted"}`}>{l}</div>))}
        </div>
        <div className="space-y-3 p-4">
          <div className="text-sm font-semibold">Shared PDFs</div>
          {["Lecture Notes", "Homework", "Previous Question Papers"].map((c) => (
            <div key={c} className="flex items-center gap-3 rounded-control border border-line p-3">
              <span className="grid h-9 w-9 place-items-center rounded-control bg-brand-50 text-brand-600"><FileText className="h-4 w-4" /></span>
              <div className="flex-1 space-y-1.5"><div className="h-2.5 w-2/3 rounded bg-line" /><div className="h-2 w-1/3 rounded bg-line/70" /></div>
              <span className="badge">{c}</span>
            </div>))}
        </div>
      </div>
    </div>
  );
}
