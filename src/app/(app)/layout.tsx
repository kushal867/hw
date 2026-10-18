import Link from "next/link";
import { LogOut } from "lucide-react";
import { BottomNav, SideNav } from "@/components/app-nav";
import { Logo } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/server-db";
import { logOut } from "@/app/actions/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireUser();
  const { count } = await (await createClient()).from("notifications").select("id", { count: "exact", head: true }).is("read_at", null);
  const unread = count ?? 0;
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[250px_1fr]">
      <aside className="sticky top-0 hidden h-screen flex-col border-r border-line bg-surface p-4 lg:flex">
        <div className="mb-6 px-2"><Logo href="/dashboard" /></div>
        <SideNav isAdmin={profile.platform_role === "admin"} unread={unread} />
        <form action={logOut} className="mt-auto"><button className="btn-ghost w-full justify-start"><LogOut className="h-4 w-4" aria-hidden />Log out</button></form>
      </aside>
      <div className="min-w-0 pb-20 lg:pb-0">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-line bg-surface/95 px-4 backdrop-blur lg:px-8">
          <div className="lg:hidden"><Logo href="/dashboard" /></div>
          <div className="ml-auto flex items-center gap-3">
            <Link href="/profile" className="flex items-center gap-2 text-sm font-medium">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-100 text-xs font-bold text-brand-700" aria-hidden>{profile.display_name.slice(0, 1).toUpperCase()}</span>
              <span className="hidden sm:inline">{profile.display_name}</span></Link>
          </div>
        </header>
        <main id="main" className="mx-auto max-w-5xl px-4 py-6 lg:px-8 lg:py-8">{children}</main>
      </div>
      <BottomNav unread={unread} />
    </div>
  );
}
