import Link from "next/link";
import { Logo } from "@/components/ui/misc";
import { getCurrentUser } from "@/lib/auth";
import { isConfigured } from "@/lib/env";
import { MobileMenu } from "@/components/mobile-menu";
import { Search } from "lucide-react";
import { AdsConsentBanner, AdsScript } from "@/components/ads/ads";

const NAV = [["/find-groups", "Find groups"], ["/public-notes", "Public notes"], ["/colleges", "Colleges"], ["/guides", "Guides"]] as const;

export async function SiteHeader() {
  const me = isConfigured() ? await getCurrentUser() : null;
  return (
    <header className="sticky top-0 z-30 border-b border-line/80 bg-surface/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-4">
        <Logo />
        <nav className="hidden items-center gap-1 text-sm font-semibold md:flex" aria-label="Main">
          {NAV.map(([h, l]) => <Link key={h} href={h} className="rounded-full px-4 py-2 text-slate-600 transition hover:bg-brand-50 hover:text-brand-700">{l}</Link>)}
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          <Link href="/search" className="btn-ghost !px-3" aria-label="Search EduSathi"><Search className="h-4 w-4" aria-hidden /></Link>
          {me ? <Link href="/dashboard" className="btn-primary">Go to your groups</Link> : <>
            <Link href="/login" className="btn-ghost">Log in</Link>
            <Link href="/signup" className="btn-primary">Join free</Link></>}
        </div>
        <MobileMenu nav={NAV} signedIn={!!me} />
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-[1.4fr_1fr_1fr]">
        <div><Logo /><p className="mt-3 max-w-xs text-sm leading-relaxed text-muted">Free study groups, shared notes and exam prep for students in Nepal.</p></div>
        <nav aria-label="Explore" className="text-sm"><h2 className="mb-3 font-bold">Explore</h2><ul className="space-y-2 text-muted">
          <li><Link className="hover:text-brand-700" href="/find-groups">Find groups</Link></li><li><Link className="hover:text-brand-700" href="/public-notes">Public notes</Link></li>
          <li><Link className="hover:text-brand-700" href="/colleges">Colleges</Link></li><li><Link className="hover:text-brand-700" href="/guides">Study guides</Link></li><li><Link className="hover:text-brand-700" href="/search">Search</Link></li><li><Link className="hover:text-brand-700" href="/pdf-maker">PDF maker</Link></li></ul></nav>
        <nav aria-label="Legal and help" className="text-sm"><h2 className="mb-3 font-bold">Trust &amp; help</h2><ul className="space-y-2 text-muted">
          <li><Link className="hover:text-brand-700" href="/about">About</Link></li><li><Link className="hover:text-brand-700" href="/privacy">Privacy Policy</Link></li><li><Link className="hover:text-brand-700" href="/terms">Terms of Service</Link></li>
          <li><Link className="hover:text-brand-700" href="/report-content">Content Reporting</Link></li><li><Link className="hover:text-brand-700" href="/contact">Contact</Link></li></ul></nav>
      </div>
      <div className="border-t border-line"><p className="mx-auto max-w-6xl px-4 py-5 text-xs text-muted">© {new Date().getFullYear()} EduSathi. Free for students.</p></div>
      <AdsScript /><AdsConsentBanner />
    </footer>
  );
}
