import Link from "next/link";
import { ArrowRight, BookMarked, Compass, FileDown, FileText, MessagesSquare, Plus, QrCode, ShieldCheck, Users } from "lucide-react";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { GroupAvatar } from "@/components/group-avatar";
import { IconTile } from "@/components/ui/misc";
import { HomeDiscover } from "@/components/public/home-discover";
import { JsonLd } from "@/components/public/json-ld";
import { abs, pageMeta } from "@/lib/seo";

export const metadata = pageMeta({
  title: "EduSathi: study groups, notes and exam prep for students in Nepal",
  description: "Join your semester's study group, share notes privately, find public notes by college and subject, and prepare for exams together. Free for students in Nepal.",
  path: "/", imageTitle: "Your Semester. Your Notes. Your Community.",
});

const STEPS = [
  { icon: Plus, t: "Create or find a group", d: "Start one for your class or homework in a minute — or search public groups and join." },
  { icon: FileText, t: "Share PDFs and ask questions", d: "Notes, assignments and past papers stay private inside your group." },
  { icon: Users, t: "Study together", d: "Discuss problems, collect important exam questions and help each other." },
];
const FAQ = [
  ["Is EduSathi really free?", "Yes. There are no subscriptions or payments."],
  ["Who can start a group?", "Any student with an account. Choose public (people can find and request to join) or private (invitation link or QR code only)."],
  ["Who can see my uploads?", "Only members of the group. A file goes public only if you ask for it and a reviewer approves it."],
  ["Do I need to use my real name?", "No. Pick any display name. Your email is never shown to others."],
  ["Can I share textbooks?", "Only share material you own or have permission to share. Copyright complaints are handled through Content Reporting."],
];

export default function Home() {
  return (
    <>
      <SiteHeader />
      <JsonLd data={[
        { "@context": "https://schema.org", "@type": "Organization", name: "EduSathi", url: abs("/"), logo: abs("/pwa-icon/512") },
        { "@context": "https://schema.org", "@type": "WebSite", name: "EduSathi", url: abs("/"), potentialAction: { "@type": "SearchAction", target: { "@type": "EntryPoint", urlTemplate: abs("/search?q={search_term_string}") }, "query-input": "required name=search_term_string" } },
      ]} />
      <main id="main">
        <section className="bg-hero relative overflow-hidden border-b border-line">
          <div className="mx-auto grid max-w-6xl items-center gap-14 px-4 pb-20 pt-14 sm:pt-20 lg:grid-cols-[1.05fr_1fr]">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white/80 px-3.5 py-1.5 text-xs font-bold text-brand-700 shadow-sm"><span className="h-2 w-2 rounded-full bg-emerald-500" />Free for students in Nepal</p>
              <h1 className="mt-5 text-[40px] font-extrabold leading-[1.05] sm:text-6xl">Your Semester.<br />Your Notes.<br /><span className="bg-gradient-to-r from-brand-600 to-violet-600 bg-clip-text text-transparent">Your Community.</span></h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-600">Share study materials, discover important exam questions, and learn together with classmates—all in one place.</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/signup" className="btn-primary btn-lg">Join EduSathi — it&apos;s free <ArrowRight className="h-4 w-4" aria-hidden /></Link>
                <Link href="/find-groups" className="btn-secondary btn-lg"><Compass className="h-4 w-4" aria-hidden />Find a group</Link>
              </div>
              <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium text-slate-600">
                {["No payments, ever at launch", "Your email stays private", "Works on your phone"].map((t) => <li key={t} className="flex items-center gap-2"><span className="grid h-5 w-5 place-items-center rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">✓</span>{t}</li>)}
              </ul>
            </div>
            <ProductPreview />
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-20" aria-labelledby="how">
          <p className="eyebrow">How it works</p><h2 id="how" className="mt-2 max-w-xl text-3xl font-extrabold sm:text-4xl">From scattered chats to one organised place</h2>
          <ol className="mt-10 grid gap-5 md:grid-cols-3">{STEPS.map((s, i) => (
            <li key={s.t} className="card relative p-7"><span className="absolute right-6 top-5 text-5xl font-extrabold text-slate-100" aria-hidden>{i + 1}</span>
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-brand-500 to-violet-600 text-white shadow-md shadow-brand-600/30"><s.icon className="h-6 w-6" aria-hidden /></span>
              <h3 className="mt-5 text-lg font-bold">{s.t}</h3><p className="mt-1.5 leading-relaxed text-muted">{s.d}</p></li>))}</ol>
        </section>

        <section className="border-y border-line bg-surface py-20" aria-labelledby="feat">
          <div className="mx-auto max-w-6xl px-4">
            <p className="eyebrow">Everything in one place</p><h2 id="feat" className="mt-2 max-w-xl text-3xl font-extrabold sm:text-4xl">Built for how students actually study</h2>
            <div className="mt-10 grid gap-5 md:grid-cols-6">
              <Feature className="md:col-span-3" icon={Users} tone="members" t="Student-created groups" d="Public or private, like the groups you already know. Owners approve requests and appoint moderators." />
              <Feature className="md:col-span-3" icon={FileText} tone="files" t="PDFs that stay private" d="Upload notes and homework to your group. Only members can read them — nothing is public unless you ask." />
              <Feature className="md:col-span-2" icon={MessagesSquare} tone="discussions" t="Discussions" d="Ask for homework help, request a missing PDF, share study tips." />
              <Feature className="md:col-span-2" icon={BookMarked} tone="questions" t="Exam questions" d="Build a bank of practice and previous-exam questions per subject." />
              <Feature className="md:col-span-2" icon={QrCode} tone="files" t="QR invitations" d="Expiring, limited-use links. Print the QR code for your class." />
              <Feature className="md:col-span-3" icon={FileDown} tone="members" t="Make study PDFs" d="Turn your notes and saved questions into a clean, printable PDF — Nepali text supported." />
              <Feature className="md:col-span-3" icon={ShieldCheck} tone="discussions" t="Safe by design" d="Report content, request takedowns, and public notes are reviewed before they appear." />
            </div>
          </div>
        </section>

        <HomeDiscover />

        <section className="mx-auto max-w-3xl px-4 py-20" aria-labelledby="faq">
          <p className="eyebrow text-center">FAQ</p><h2 id="faq" className="mt-2 text-center text-3xl font-extrabold">Questions, answered</h2>
          <div className="mt-8 space-y-3">{FAQ.map(([q, a]) => (
            <details key={q} className="card group p-5 open:shadow-pop"><summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-bold [&::-webkit-details-marker]:hidden">{q}<span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-700 transition group-open:rotate-45"><Plus className="h-4 w-4" aria-hidden /></span></summary><p className="mt-3 leading-relaxed text-muted">{a}</p></details>))}</div>
        </section>

        <section className="px-4 pb-20"><div className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 via-indigo-600 to-violet-600 px-6 py-14 text-center text-white sm:px-12">
          <div aria-hidden className="absolute -left-10 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
          <h2 className="relative text-3xl font-extrabold sm:text-4xl">Start your group today</h2><p className="relative mx-auto mt-3 max-w-lg text-indigo-100">It takes a minute. Invite your classmates with a link or QR code.</p>
          <div className="relative mt-7 flex flex-wrap justify-center gap-3"><Link href="/signup" className="btn btn-lg bg-white text-brand-700 hover:bg-indigo-50">Create your account</Link><Link href="/find-groups" className="btn btn-lg border border-white/30 bg-white/10 text-white hover:bg-white/20">Browse groups</Link></div>
        </div></section>
      </main>
      <SiteFooter />
    </>
  );
}

function Feature({ icon, tone, t, d, className = "" }: { icon: typeof Users; tone: "files" | "discussions" | "questions" | "members"; t: string; d: string; className?: string }) {
  return <div className={`rounded-2xl border border-line bg-canvas p-6 transition hover:border-brand-200 hover:bg-white hover:shadow-pop ${className}`}><IconTile icon={icon} tone={tone} size={44} /><h3 className="mt-4 text-lg font-bold">{t}</h3><p className="mt-1.5 leading-relaxed text-muted">{d}</p></div>;
}

/** Illustrative UI mock-up of a group. Skeleton lines + generic labels only — no invented data. */
function ProductPreview() {
  return (
    <div className="relative mx-auto w-full max-w-lg" aria-hidden>
      <div className="card overflow-hidden shadow-pop">
        <div className="h-20" style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }} />
        <div className="px-5 pb-5">
          <div className="-mt-7 flex items-end gap-3"><GroupAvatar name="Your Group" seed="preview" size={60} className="ring-4 ring-surface" /><div className="pb-1"><div className="h-3.5 w-32 rounded bg-slate-200" /><div className="mt-2 h-2.5 w-20 rounded bg-slate-100" /></div></div>
          <div className="mt-4 flex gap-1.5 rounded-xl bg-slate-100 p-1 text-[11px] font-bold"><span className="rounded-lg bg-brand-600 px-3 py-1.5 text-white">PDFs</span><span className="px-3 py-1.5 text-slate-600">Discussions</span><span className="px-3 py-1.5 text-slate-600">Questions</span></div>
          <div className="mt-4 space-y-2.5">{[["Lecture Notes", "files"], ["Homework", "discussions"], ["Past Papers", "questions"]].map(([c, tone]) => (
            <div key={c} className="flex items-center gap-3 rounded-xl border border-line p-3"><IconTile icon={FileText} tone={tone as "files"} size={36} /><div className="flex-1 space-y-1.5"><div className="h-2.5 w-3/4 rounded bg-slate-200" /><div className="h-2 w-1/3 rounded bg-slate-100" /></div><span className="badge">{c}</span></div>))}</div>
        </div>
      </div>
      <div className="absolute -bottom-6 -left-4 hidden rounded-2xl border border-line bg-white p-3.5 shadow-pop sm:flex sm:items-center sm:gap-3"><IconTile icon={QrCode} tone="members" size={38} /><div><p className="text-xs font-bold">Invite with a QR code</p><p className="text-[11px] text-slate-600">Expires automatically</p></div></div>
      <div className="absolute -right-3 -top-4 hidden rounded-2xl border border-line bg-white p-3 shadow-pop sm:flex sm:items-center sm:gap-2.5"><span className="grid h-8 w-8 place-items-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">✓</span><p className="text-xs font-bold">Private to members</p></div>
    </div>
  );
}
