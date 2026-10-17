"use client";
import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";

export function MobileMenu({ nav, signedIn }: { nav: readonly (readonly [string, string])[]; signedIn: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="md:hidden">
      <button className="btn-ghost !px-2" aria-expanded={open} aria-controls="mobile-nav" aria-label={open ? "Close menu" : "Open menu"} onClick={() => setOpen(!open)}>
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>
      {open && (
        <nav id="mobile-nav" aria-label="Mobile" className="absolute inset-x-0 top-16 space-y-1 border-b border-line bg-surface p-4 shadow-pop">
          {nav.map(([h, l]) => <Link key={h} href={h} onClick={() => setOpen(false)} className="block rounded-control px-3 py-3 font-medium hover:bg-brand-50">{l}</Link>)}
          <div className="grid gap-2 pt-2">
            {signedIn ? <Link href="/dashboard" className="btn-primary">Dashboard</Link> : <>
              <Link href="/login" className="btn-secondary">Log In</Link><Link href="/signup" className="btn-primary">Join EduSathi</Link></>}
          </div>
        </nav>
      )}
    </div>
  );
}
