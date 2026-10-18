"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, FileDown, GraduationCap, Globe, LayoutDashboard, Settings, Shield, User } from "lucide-react";

const ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/my-groups", label: "My Groups", icon: GraduationCap },
  { href: "/public-notes", label: "Public Notes", icon: Globe },
  { href: "/pdf-maker", label: "PDF Maker", icon: FileDown },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/profile", label: "Profile", icon: User },
  { href: "/settings", label: "Settings", icon: Settings },
];
const MOBILE = ["/dashboard", "/my-groups", "/pdf-maker", "/notifications", "/profile"];

export function SideNav({ isAdmin, unread }: { isAdmin: boolean; unread: number }) {
  const path = usePathname();
  const items = isAdmin ? [...ITEMS, { href: "/admin/reports", label: "Admin", icon: Shield }] : ITEMS;
  return (
    <nav aria-label="Primary" className="space-y-1">
      {items.map(({ href, label, icon: Icon }) => {
        const active = path === href || path.startsWith(href + "/") || (href === "/my-groups" && path.startsWith("/groups"));
        return (
          <Link key={href} href={href} aria-current={active ? "page" : undefined}
            className={`flex items-center gap-3 rounded-control px-3 py-2.5 text-sm font-medium ${active ? "bg-brand-50 text-brand-700" : "text-muted hover:bg-brand-50/60 hover:text-ink"}`}>
            <Icon className="h-4 w-4" aria-hidden />{label}
            {href === "/notifications" && unread > 0 && <span className="ml-auto rounded-full bg-brand-600 px-2 text-xs text-white" aria-label={`${unread} unread`}>{unread > 99 ? "99+" : unread}</span>}
          </Link>);
      })}
    </nav>
  );
}

export function BottomNav({ unread }: { unread: number }) {
  const path = usePathname();
  return (
    <nav aria-label="Mobile primary" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden">
      {ITEMS.filter((i) => MOBILE.includes(i.href)).map(({ href, label, icon: Icon }) => {
        const active = path === href || path.startsWith(href + "/") || (href === "/my-groups" && path.startsWith("/groups"));
        return (
          <Link key={href} href={href} aria-current={active ? "page" : undefined}
            className={`relative flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${active ? "text-brand-700" : "text-muted"}`}>
            <Icon className="h-5 w-5" aria-hidden />{label.replace("My ", "")}
            {href === "/notifications" && unread > 0 && <span className="absolute right-[28%] top-1.5 h-2 w-2 rounded-full bg-brand-600" aria-label="unread notifications" />}
          </Link>);
      })}
    </nav>
  );
}
