import Link from "next/link";
import { Bell, CalendarDays, CheckCheck, FileCheck, MessageCircle, ShieldCheck, UserPlus, Users } from "lucide-react";
import { ActionForm } from "@/components/ui/action-form";
import { LiveRefresh } from "@/components/live-refresh";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/server-db";
import { timeAgo } from "@/lib/format";
import { markRead } from "@/app/actions/account";

export const metadata = { title: "Notifications" };
const ICON: Record<string, { icon: typeof Bell; tone: string }> = {
  reply: { icon: MessageCircle, tone: "bg-sky-50 text-sky-600" }, join: { icon: UserPlus, tone: "bg-emerald-50 text-emerald-600" },
  join_request: { icon: UserPlus, tone: "bg-amber-50 text-amber-600" }, publication: { icon: FileCheck, tone: "bg-indigo-50 text-indigo-600" },
  group: { icon: Users, tone: "bg-violet-50 text-violet-600" }, event: { icon: CalendarDays, tone: "bg-rose-50 text-rose-600" },
};

export default async function Notifications() {
  const { profile } = await requireUser();
  const { data } = await (await createClient()).from("notifications").select("*").order("created_at", { ascending: false }).limit(50);
  const unread = data?.some((n) => !n.read_at);
  return (
    <div className="mx-auto max-w-3xl">
      <LiveRefresh table="notifications" filter={`user_id=eq.${profile.id}`} />
      <PageHeader title="Notifications" sub="Replies, join requests, deadlines and approvals.">{unread && <ActionForm action={async () => { "use server"; return markRead(); }}><button className="btn-secondary"><CheckCheck className="h-4 w-4" aria-hidden />Mark all read</button></ActionForm>}</PageHeader>
      {!data?.length ? <EmptyState icon={Bell} title="You're all caught up">When classmates reply to you or a group needs your attention, it shows up here.</EmptyState> : (
        <ul className="card divide-y divide-line overflow-hidden">{data.map((n) => {
          const { icon: Icon, tone } = ICON[n.notification_type] ?? { icon: ShieldCheck, tone: "bg-slate-100 text-slate-600" };
          const inner = (<><span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${tone}`}><Icon className="h-5 w-5" aria-hidden /></span>
            <div className="min-w-0 flex-1"><p className={`text-sm ${n.read_at ? "font-medium" : "font-bold"}`}>{n.title}</p>{n.body && <p className="mt-0.5 line-clamp-2 text-sm text-muted">{n.body}</p>}<p className="mt-1 text-xs text-muted">{timeAgo(n.created_at)}</p></div></>);
          return (
            <li key={n.id} className={`flex items-center gap-4 p-4 ${n.read_at ? "" : "bg-brand-50/50"}`}>
              {n.destination ? <Link href={n.destination} className="flex min-w-0 flex-1 items-center gap-4 hover:opacity-90">{inner}</Link> : <div className="flex min-w-0 flex-1 items-center gap-4">{inner}</div>}
              {!n.read_at && <ActionForm action={async () => { "use server"; return markRead(n.id); }}><button className="btn-ghost !min-h-[36px] !px-3 text-xs" aria-label="Mark as read"><span className="mr-1 h-2 w-2 rounded-full bg-brand-600" aria-hidden />Mark read</button></ActionForm>}
            </li>);
        })}</ul>)}
    </div>);
}
