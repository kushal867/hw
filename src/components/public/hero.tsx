import type { ReactNode } from "react";
import { Breadcrumbs, type Crumb } from "@/components/public/breadcrumbs";

/** Shared header for public content pages: breadcrumbs, title, short intro. */
export function PublicHero({ crumbs, eyebrow, title, sub, children }: { crumbs: Crumb[]; eyebrow?: string; title: string; sub?: string; children?: ReactNode }) {
  return (
    <section className="bg-hero border-b border-line">
      <div className="mx-auto max-w-6xl px-4 pb-10 pt-7 sm:pt-9">
        <Breadcrumbs items={crumbs} />
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h1 className="max-w-4xl text-3xl font-extrabold leading-tight sm:text-4xl">{title}</h1>
        {sub && <p className="mt-3 max-w-3xl text-[15px] leading-relaxed text-slate-600">{sub}</p>}
        {children}
      </div>
    </section>
  );
}

export const Section = ({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) => (
  <section className="mt-12 first:mt-0">
    <div className="mb-4 flex items-end justify-between gap-3"><h2 className="text-xl font-extrabold">{title}</h2>{action}</div>
    {children}
  </section>
);
