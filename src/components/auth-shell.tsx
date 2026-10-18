import Link from "next/link";
import { BookOpen, FileText, MessagesSquare, ShieldCheck, Users } from "lucide-react";
import { Logo, NotConfigured } from "@/components/ui/misc";
import { isConfigured } from "@/lib/env";

const POINTS = [
  { icon: Users, t: "Create or join groups", d: "For your class, homework sharing or a study circle." },
  { icon: FileText, t: "Share PDFs privately", d: "Notes and assignments stay inside your group." },
  { icon: MessagesSquare, t: "Ask and answer together", d: "Discussions and important exam questions." },
  { icon: ShieldCheck, t: "Free, and your email stays private", d: "Only your display name is visible to others." },
];

export function AuthShell({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <main id="main" className="grid min-h-screen lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-brand-600 via-indigo-600 to-violet-700 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div aria-hidden className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-white/10 blur-3xl" /><div aria-hidden className="absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-fuchsia-400/20 blur-3xl" />
        <Link href="/" className="relative flex items-center gap-2.5 text-xl font-bold" aria-label="EduSathi home"><span className="grid h-10 w-10 place-items-center rounded-xl bg-white/15 ring-1 ring-white/25"><BookOpen className="h-5 w-5" aria-hidden /></span>EduSathi</Link>
        <div className="relative">
          <h2 className="max-w-md text-4xl font-extrabold leading-[1.1]">Your Semester. Your Notes. Your Community.</h2>
          <ul className="mt-9 space-y-5">{POINTS.map((p) => (
            <li key={p.t} className="flex gap-4"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/15 ring-1 ring-white/20"><p.icon className="h-5 w-5" aria-hidden /></span>
              <div><p className="font-bold">{p.t}</p><p className="text-sm text-indigo-100">{p.d}</p></div></li>))}</ul>
        </div>
        <p className="relative text-sm text-indigo-200">Made for students in Nepal.</p>
      </aside>
      <div className="flex flex-col px-5 py-8 sm:px-10">
        <div className="mb-8 flex items-center justify-between lg:hidden"><Logo /><Link href="/find-groups" className="text-sm font-semibold text-brand-700">Browse groups</Link></div>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-6">
          <h1 className="text-[28px] font-extrabold leading-tight">{title}</h1>
          <p className="mb-7 mt-2 text-[15px] leading-relaxed text-muted">{sub}</p>
          {!isConfigured() && <div className="mb-5"><NotConfigured /></div>}
          {children}
        </div>
        <p className="text-center text-xs text-muted">By continuing you agree to our <Link href="/terms" className="underline">Terms</Link> and <Link href="/privacy" className="underline">Privacy Policy</Link>.</p>
      </div>
    </main>
  );
}
