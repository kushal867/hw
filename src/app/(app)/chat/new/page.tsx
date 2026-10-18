import Link from "next/link";
import { ArrowLeft, Search, Users } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { StartChatButton } from "@/components/chat/start-chat-button";
import { requireUser } from "@/lib/auth";
import { userSql } from "@/lib/db";

export const metadata = { title: "New message" };

export default async function NewChat({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const { profile } = await requireUser();
  // Classmates = people who share at least one active group with you. Row Level Security applies to every table here.
  const people = await userSql<{ id: string; display_name: string; avatar_path: string | null; groups: string[] }>(profile.id, `
    select p.id, p.display_name, p.avatar_path, array_agg(distinct g.name order by g.name) as groups
    from public.group_members a
    join public.group_members b on b.group_id = a.group_id and b.user_id <> a.user_id
    join public.profiles p on p.id = b.user_id
    join public.groups g on g.id = a.group_id
    where a.user_id = $1 and a.membership_status = 'active' and b.membership_status = 'active'
      and ($2::text = '' or p.display_name ilike '%' || $2 || '%')
    group by p.id, p.display_name, p.avatar_path
    order by p.display_name limit 60`, [profile.id, q.slice(0, 60).replace(/[%_\\]/g, "\\$&")]);
  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b border-line px-3 py-3 sm:px-5">
        <Link href="/chat" className="btn-ghost !min-h-[40px] !px-2.5 lg:hidden" aria-label="Back to chats"><ArrowLeft className="h-5 w-5" aria-hidden /></Link>
        <div><h2 className="font-bold leading-tight">New message</h2><p className="text-xs text-muted">You can message people who share a group with you.</p></div>
      </header>
      <form role="search" className="relative border-b border-line p-3 sm:px-5">
        <Search className="pointer-events-none absolute left-7 top-6 h-4 w-4 text-slate-500 sm:left-9" aria-hidden />
        <label htmlFor="people-q" className="sr-only">Search classmates</label>
        <input id="people-q" name="q" defaultValue={q} placeholder="Search classmates by name" className="input rounded-full pl-10" />
      </form>
      <ul className="min-h-0 flex-1 divide-y divide-line/70 overflow-y-auto">
        {people.length === 0 && (
          <li className="grid place-items-center p-10 text-center"><div><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-600"><Users className="h-6 w-6" aria-hidden /></span>
            <p className="mt-3 font-bold">{q ? "No classmates match" : "No classmates yet"}</p>
            <p className="mx-auto mt-1 max-w-xs text-sm text-muted">{q ? "Try a different name." : "Join or create a group and its members will appear here."}</p>
            {!q && <Link href="/find-groups" className="btn-primary mt-4">Find groups</Link>}</div></li>)}
        {people.map((p) => (
          <li key={p.id} className="flex items-center gap-3 px-3 py-3 sm:px-5">
            <Avatar name={p.display_name} path={p.avatar_path} size={44} />
            <div className="min-w-0 flex-1"><p className="truncate font-bold">{p.display_name}</p><p className="truncate text-xs text-muted">{p.groups.join(" · ")}</p></div>
            <StartChatButton userId={p.id} name={p.display_name} />
          </li>))}
      </ul>
    </div>
  );
}
