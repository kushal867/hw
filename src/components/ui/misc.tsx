import Link from "next/link";
import { AlertTriangle, BookOpen, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export const Logo = ({ href = "/" }: { href?: string }) => (
  <Link href={href} className="flex items-center gap-2 font-bold tracking-tight text-ink">
    <span className="grid h-8 w-8 place-items-center rounded-control bg-brand-600 text-white"><BookOpen className="h-4 w-4" aria-hidden /></span>
    <span className="text-lg">Edu<span className="text-brand-600">Sathi</span></span>
  </Link>
);

export function EmptyState({ icon: Icon = BookOpen, title, children, action }: { icon?: LucideIcon; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center px-6 py-12 text-center">
      <span className="mb-3 grid h-11 w-11 place-items-center rounded-full bg-brand-50 text-brand-600"><Icon className="h-5 w-5" aria-hidden /></span>
      <h3 className="font-semibold">{title}</h3>
      {children && <p className="mt-1 max-w-sm text-sm text-muted">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export const ErrorState = ({ message = "We couldn't load this. Please try again." }: { message?: string }) => (
  <div role="alert" className="card flex items-start gap-3 border-danger/30 bg-danger/5 p-4 text-sm">
    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden /><p>{message}</p>
  </div>
);

export const NotConfigured = () => (
  <div role="status" className="card border-warn/40 bg-warn/5 p-4 text-sm">
    <strong>Supabase is not configured.</strong> Copy <code>.env.example</code> to <code>.env.local</code> and set the Supabase URL and keys — see README.
  </div>
);

export const PageHeader = ({ title, children, sub }: { title: string; sub?: string; children?: ReactNode }) => (
  <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
    <div><h1 className="text-2xl font-bold tracking-tight">{title}</h1>{sub && <p className="mt-1 text-sm text-muted">{sub}</p>}</div>
    {children && <div className="flex flex-wrap gap-2">{children}</div>}
  </div>
);

export const ListSkeleton = ({ rows = 4 }: { rows?: number }) => (
  <div className="space-y-3" aria-busy aria-label="Loading">{Array.from({ length: rows }).map((_, i) => <div key={i} className="skeleton h-20" />)}</div>
);

export function Field({ label, name, hint, ...rest }: { label: string; name: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label htmlFor={name} className="label">{label}</label>
      <input id={name} name={name} className="input" aria-describedby={hint ? `${name}-hint` : undefined} {...rest} />
      {hint && <p id={`${name}-hint`} className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export const Pagination = ({ page, hasNext, base }: { page: number; hasNext: boolean; base: string }) => {
  const href = (p: number) => `${base}${base.includes("?") ? "&" : "?"}page=${p}`;
  return (
    <nav className="mt-6 flex justify-between" aria-label="Pagination">
      {page > 1 ? <Link className="btn-secondary" href={href(page - 1)}>Previous</Link> : <span />}
      {hasNext && <Link className="btn-secondary" href={href(page + 1)}>Next</Link>}
    </nav>
  );
};
