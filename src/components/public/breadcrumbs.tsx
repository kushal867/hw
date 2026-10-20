import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { JsonLd } from "@/components/public/json-ld";
import { abs } from "@/lib/seo";

export type Crumb = { name: string; href: string };

/** Visible breadcrumb trail + BreadcrumbList structured data. */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <>
      <nav aria-label="Breadcrumb" className="mb-5 text-sm text-muted">
        <ol className="flex flex-wrap items-center gap-1.5">
          {items.map((it, i) => (
            <li key={it.href} className="flex items-center gap-1.5">
              {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-slate-400" aria-hidden />}
              {i === items.length - 1 ? <span aria-current="page" className="font-semibold text-slate-700">{it.name}</span>
                : <Link href={it.href} className="transition hover:text-brand-700 hover:underline">{it.name}</Link>}
            </li>))}
        </ol>
      </nav>
      <JsonLd data={{ "@context": "https://schema.org", "@type": "BreadcrumbList",
        itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: abs(it.href) })) }} />
    </>
  );
}
