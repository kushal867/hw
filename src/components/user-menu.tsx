import Link from "next/link";
import { LogOut, Settings, Shield, User } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { logOut } from "@/app/actions/auth";

/** Dependency-free dropdown (native <details>): keyboard accessible, closes on outside click via the browser. */
export function UserMenu({ name, avatarPath, isAdmin }: { name: string; avatarPath: string | null; isAdmin: boolean }) {
  const item = "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100";
  return (
    <details className="group relative">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-full p-1 pr-3 transition hover:bg-slate-100 [&::-webkit-details-marker]:hidden">
        <Avatar name={name} path={avatarPath} size={34} /><span className="max-w-[140px] truncate text-sm font-semibold max-sm:sr-only">{name}</span>
      </summary>
      <div className="absolute right-0 top-full z-40 mt-2 w-56 rounded-2xl border border-line bg-surface p-1.5 shadow-pop">
        <p className="truncate px-3 py-2 text-xs font-semibold text-muted">{name}</p>
        <Link href="/profile" className={item}><User className="h-4 w-4" aria-hidden />Profile</Link>
        <Link href="/settings" className={item}><Settings className="h-4 w-4" aria-hidden />Settings</Link>
        {isAdmin && <Link href="/admin/reports" className={item}><Shield className="h-4 w-4" aria-hidden />Admin</Link>}
        <form action={logOut}><button className={`${item} text-red-600 hover:!bg-red-50`}><LogOut className="h-4 w-4" aria-hidden />Log out</button></form>
      </div>
    </details>
  );
}
