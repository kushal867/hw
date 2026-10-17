import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { Logo } from "@/components/ui/misc";

const LINKS = [["/admin/reports", "Reports"], ["/admin/content", "Review queue"], ["/admin/colleges", "Colleges & courses"], ["/admin/users", "Users"], ["/admin/audit-logs", "Audit & abuse"]];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();   // server-side gate for every /admin route
  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-surface"><div className="mx-auto flex max-w-6xl items-center gap-6 overflow-x-auto px-4 py-3">
        <Logo href="/dashboard" /><span className="badge">Admin</span>
        <nav aria-label="Admin" className="flex gap-4 text-sm font-medium">{LINKS.map(([h, l]) => <Link key={h} href={h} className="whitespace-nowrap text-muted hover:text-brand-700">{l}</Link>)}</nav>
      </div></header>
      <main id="main" className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>);
}
