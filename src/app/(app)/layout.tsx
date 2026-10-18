import Link from "next/link";
import { Bell, Search } from "lucide-react";
import { ChatProvider } from "@/components/chat/chat-provider";
import { unreadFor } from "@/lib/chat/queries";
import { BottomNav, SideNav } from "@/components/app-nav";
import { UserMenu } from "@/components/user-menu";
import { Logo } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/server-db";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireUser();
  const supabase = await createClient();
  const [{ count }, { data: mine }, chatUnread] = await Promise.all([
    supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null),
    supabase.from("group_members").select("joined_at, groups(id, name, status)").eq("user_id", profile.id).eq("membership_status", "active").order("joined_at", { ascending: false }).limit(12),
    unreadFor(profile.id).catch(() => []),                                  // chat must never take the whole app down
  ]);
  const unread = count ?? 0;
  const groups = ((mine ?? []) as any[]).filter((m) => m.groups?.status === "active").slice(0, 8).map((m) => ({ id: m.groups.id as string, name: m.groups.name as string }));
  return (
    <ChatProvider userId={profile.id} initialUnread={chatUnread}>
    <div className="min-h-screen lg:grid lg:grid-cols-[272px_1fr]">
      <aside className="sticky top-0 hidden h-screen flex-col gap-6 border-r border-line bg-surface p-4 lg:flex">
        <div className="px-2 pt-1"><Logo href="/dashboard" /></div>
        <SideNav groups={groups} isAdmin={profile.platform_role === "admin"} />
        <Link href="/groups/new" className="btn-primary w-full">Create a group</Link>
      </aside>
      <div className="min-w-0 pb-24 lg:pb-0">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-surface/90 px-4 backdrop-blur lg:px-8">
          <div className="lg:hidden"><Logo href="/dashboard" compact /></div>
          <form action="/find-groups" role="search" className="relative hidden max-w-md flex-1 sm:block">
            <Search className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-slate-500" aria-hidden />
            <label htmlFor="global-q" className="sr-only">Search groups</label>
            <input id="global-q" name="q" placeholder="Search groups…" className="input !min-h-[40px] rounded-full bg-slate-100/80 pl-10 hover:border-line focus:bg-surface" />
          </form>
          <div className="ml-auto flex items-center gap-1">
            <Link href="/find-groups" className="btn-ghost !px-2.5 sm:hidden" aria-label="Search groups"><Search className="h-5 w-5" /></Link>
            <Link href="/notifications" className="relative grid h-10 w-10 place-items-center rounded-full text-slate-600 transition hover:bg-slate-100" aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}>
              <Bell className="h-5 w-5" aria-hidden />{unread > 0 && <span className="absolute right-1 top-1 grid min-w-[18px] place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-[18px] text-white ring-2 ring-white">{unread > 9 ? "9+" : unread}</span>}
            </Link>
            <UserMenu name={profile.display_name} avatarPath={profile.avatar_path} isAdmin={profile.platform_role === "admin"} />
          </div>
        </header>
        <main id="main" className="mx-auto max-w-5xl px-4 py-7 lg:px-8 lg:py-9">{children}</main>
      </div>
      <BottomNav />
    </div>
    </ChatProvider>
  );
}
