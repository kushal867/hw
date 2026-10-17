import Link from "next/link";
import { Bell } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { LiveRefresh } from "@/components/live-refresh";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import { markRead } from "@/app/actions/account";

export const metadata = { title: "Notifications" };

export default async function Notifications() {
  const { profile } = await requireUser();
  const { data } = await (await createClient()).from("notifications").select("*").order("created_at", { ascending: false }).limit(50);
  const unread = data?.some((n) => !n.read_at);
  return (
    <>
      <LiveRefresh table="notifications" filter={`user_id=eq.${profile.id}`} />
      <PageHeader title="Notifications">{unread && <ActionForm action={async () => { "use server"; return markRead(); }}><SubmitButton variant="secondary">Mark all read</SubmitButton></ActionForm>}</PageHeader>
      {!data?.length ? <EmptyState icon={Bell} title="You're all caught up">Replies, approvals and updates will show up here.</EmptyState> : (
        <ul className="space-y-2">{data.map((n) => (
          <li key={n.id} className={`card p-4 ${n.read_at ? "" : "border-brand-200 bg-brand-50/40"}`}>
            <div className="flex items-start justify-between gap-3"><div>
              {n.destination ? <Link href={n.destination} className="font-medium hover:text-brand-700">{n.title}</Link> : <p className="font-medium">{n.title}</p>}
              {n.body && <p className="text-sm text-muted">{n.body}</p>}<p className="mt-1 text-xs text-muted">{formatDate(n.created_at, true)}</p></div>
              {!n.read_at && <ActionForm action={async () => { "use server"; return markRead(n.id); }}><SubmitButton variant="ghost">Mark read</SubmitButton></ActionForm>}</div></li>))}</ul>)}
    </>);
}
