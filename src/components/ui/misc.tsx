import Link from "next/link";
import { AlertTriangle, BookOpen, ChevronLeft, ChevronRight, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export const Logo = ({ href = "/", compact = false }: { href?: string; compact?: boolean }) => (
  <Link href={href} className="group flex items-center gap-2.5 font-bold tracking-tight text-ink" aria-label="EduSathi home">
    <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-violet-600 text-white shadow-md shadow-brand-600/30 transition group-hover:scale-105"><BookOpen className="h-[18px] w-[18px]" aria-hidden /></span>
    {!compact && <span className="text-[19px]">Edu<span className="text-brand-600">Sathi</span></span>}
  </Link>
);

/** Friendly empty state: soft illustration tile, one clear sentence, one clear next step. */
export function EmptyState({ icon: Icon = BookOpen, title, children, action }: { icon?: LucideIcon; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="card relative flex flex-col items-center overflow-hidden px-6 py-14 text-center">
      <div aria-hidden className="pointer-events-none absolute -top-16 left-1/2 h-40 w-72 -translate-x-1/2 rounded-full bg-brand-100/60 blur-3xl" />
      <span className="relative mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-brand-50 to-brand-100 text-brand-600 ring-8 ring-brand-50/60"><Icon className="h-7 w-7" aria-hidden /></span>
      <h3 className="relative text-lg font-bold">{title}</h3>
      {children && <p className="relative mt-1.5 max-w-sm text-sm leading-relaxed text-muted">{children}</p>}
      {action && <div className="relative mt-5">{action}</div>}
    </div>
  );
}

export const ErrorState = ({ message = "We couldn't load this. Please try again." }: { message?: string }) => (
  <div role="alert" className="card flex items-start gap-3 border-red-200 bg-red-50 p-4 text-sm text-red-900">
    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden /><p>{message}</p>
  </div>
);

export const NotConfigured = () => (
  <div role="status" className="card border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
    <strong>The database is not configured.</strong> Copy <code>.env.example</code> to <code>.env.local</code> and set <code>DATABASE_URL</code> — see README.
  </div>
);

export const PageHeader = ({ title, children, sub, eyebrow }: { title: string; sub?: string; eyebrow?: string; children?: ReactNode }) => (
  <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
    <div className="min-w-0">
      {eyebrow && <p className="eyebrow mb-1.5">{eyebrow}</p>}
      <h1 className="text-[26px] font-extrabold leading-tight sm:text-3xl">{title}</h1>
      {sub && <p className="mt-1.5 max-w-2xl text-[15px] leading-relaxed text-muted">{sub}</p>}
    </div>
    {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
  </div>
);

export const SectionTitle = ({ children, action }: { children: ReactNode; action?: ReactNode }) => (
  <div className="mb-3 flex items-center justify-between gap-3"><h2 className="text-base font-bold">{children}</h2>{action}</div>
);

export const ListSkeleton = ({ rows = 4 }: { rows?: number }) => (
  <div className="space-y-3" aria-busy aria-label="Loading">{Array.from({ length: rows }).map((_, i) => <div key={i} className="skeleton h-24" />)}</div>
);

export function Field({ label, name, hint, ...rest }: { label: string; name: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label htmlFor={name} className="label">{label}</label>
      <input id={name} name={name} className="input" aria-describedby={hint ? `${name}-hint` : undefined} {...rest} />
      {hint && <p id={`${name}-hint`} className="mt-1.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export const Pagination = ({ page, hasNext, base }: { page: number; hasNext: boolean; base: string }) => {
  const href = (p: number) => `${base}${base.includes("?") ? "&" : "?"}page=${p}`;
  if (page === 1 && !hasNext) return null;
  return (
    <nav className="mt-8 flex items-center justify-between" aria-label="Pagination">
      {page > 1 ? <Link className="btn-secondary" href={href(page - 1)}><ChevronLeft className="h-4 w-4" aria-hidden />Previous</Link> : <span />}
      <span className="text-sm text-muted">Page {page}</span>
      {hasNext ? <Link className="btn-secondary" href={href(page + 1)}>Next<ChevronRight className="h-4 w-4" aria-hidden /></Link> : <span />}
    </nav>
  );
};

/** Colour-coded content types, used consistently for icons and tiles across the app. */
export const TONES = {
  files: "bg-indigo-50 text-indigo-600",
  discussions: "bg-sky-50 text-sky-600",
  questions: "bg-amber-50 text-amber-600",
  members: "bg-emerald-50 text-emerald-600",
} as const;

export const IconTile = ({ icon: Icon, tone, size = 40 }: { icon: LucideIcon; tone: keyof typeof TONES; size?: number }) => (
  <span aria-hidden className={`grid shrink-0 place-items-center rounded-xl ${TONES[tone]}`} style={{ width: size, height: size }}><Icon style={{ width: size * 0.5, height: size * 0.5 }} /></span>
);
