import Link from "next/link";
import { Compass } from "lucide-react";
import { SiteFooter, SiteHeader } from "@/components/site-header";

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="bg-hero grid place-items-center px-4 py-24">
        <div className="max-w-md text-center">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-brand-500 to-violet-600 text-white shadow-lg shadow-brand-600/30"><Compass className="h-8 w-8" aria-hidden /></span>
          <p className="eyebrow mt-6">Error 404</p>
          <h1 className="mt-2 text-3xl font-extrabold">We couldn&apos;t find that page</h1>
          <p className="mt-3 leading-relaxed text-muted">The link may be old, or the group may be private. Try finding what you need from here.</p>
          <div className="mt-7 flex flex-wrap justify-center gap-3"><Link href="/" className="btn-primary">Go home</Link><Link href="/find-groups" className="btn-secondary">Find groups</Link></div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
