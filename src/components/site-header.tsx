import Link from "next/link";
import { Logo } from "@/components/ui/misc";
import { getCurrentUser } from "@/lib/auth";
import { isConfigured } from "@/lib/env";
import { MobileMenu } from "@/components/mobile-menu";

const NAV = [["/", "Home"], ["/public-notes", "Explore Notes"], ["/find-groups", "Find Groups"], ["/colleges", "Colleges"], ["/about", "About"]] as const;

export async function SiteHeader() {
  const me = isConfigured() ? await getCurrentUser() : null;
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Logo />
        <nav className="hidden items-center gap-6 text-sm font-medium md:flex" aria-label="Main">
          {NAV.map(([h, l]) => <Link key={h} href={h} className="text-muted hover:text-brand-700">{l}</Link>)}
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          {me ? <Link href="/dashboard" className="btn-primary">Dashboard</Link> : <>
            <Link href="/login" className="btn-ghost">Log In</Link>
            <Link href="/signup" className="btn-primary">Join EduSathi</Link></>}
        </div>
        <MobileMenu nav={NAV} signedIn={!!me} />
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-8 text-sm text-muted">
        <p>© {new Date().getFullYear()} EduSathi. Free for students.</p>
        <nav className="flex flex-wrap gap-5" aria-label="Footer">
          <Link href="/privacy">Privacy Policy</Link><Link href="/terms">Terms of Service</Link>
          <Link href="/report-content">Content Reporting</Link><Link href="/contact">Contact</Link>
        </nav>
      </div>
    </footer>
  );
}
