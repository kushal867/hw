import { Check, MoreHorizontal, ShieldCheck, UserMinus, X } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { ActionForm } from "@/components/ui/action-form";
import { StartChatButton } from "@/components/chat/start-chat-button";
import { SectionTitle } from "@/components/ui/misc";
import { groupAccess } from "@/lib/group";
import { createClient } from "@/lib/server-db";
import { BADGES, formatDate } from "@/lib/format";
import { decideRequest, removeMember, setRole } from "@/app/actions/groups";

export const metadata = { title: "Members" };
const ROLE_TONE: Record<string, string> = { owner: "bg-amber-50 text-amber-700", moderator: "bg-sky-50 text-sky-700", member: "bg-slate-100 text-slate-600" };

export default async function Members({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await groupAccess(id);
  const supabase = await createClient();
  const { data: rows } = await supabase.from("group_members").select("user_id, role, membership_status, joined_at, profiles(display_name, avatar_path, profile_badges:profile_badges(badge_type))")
    .eq("group_id", id).neq("membership_status", "removed").order("joined_at");
  const active = (rows ?? []).filter((r: any) => r.membership_status === "active").sort((x: any, y: any) => ["owner", "moderator", "member"].indexOf(x.role) - ["owner", "moderator", "member"].indexOf(y.role));
  const pending = (rows ?? []).filter((r: any) => r.membership_status === "pending");
  const isOwner = a.role === "owner" || a.isAdmin;
  const menuItem = "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-100";

  return (
    <div className="space-y-8">
      {a.canModerate && pending.length > 0 && (
        <section aria-labelledby="pend" className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5">
          <h2 id="pend" className="mb-3 font-bold">Join requests <span className="badge-warn ml-1">{pending.length}</span></h2>
          <ul className="space-y-2">{pending.map((m: any) => (
            <li key={m.user_id} className="flex flex-wrap items-center gap-3 rounded-xl bg-white p-3">
              <Avatar name={m.profiles?.display_name ?? "?"} path={m.profiles?.avatar_path} size={40} /><span className="min-w-0 flex-1 truncate font-semibold">{m.profiles?.display_name ?? "Student"}</span>
              <span className="flex gap-2">
                <ActionForm action={async () => { "use server"; return decideRequest(id, m.user_id, true); }}><button className="btn-primary !min-h-[38px]"><Check className="h-4 w-4" aria-hidden />Approve</button></ActionForm>
                <ActionForm action={async () => { "use server"; return decideRequest(id, m.user_id, false); }}><button className="btn-secondary !min-h-[38px]"><X className="h-4 w-4" aria-hidden />Decline</button></ActionForm></span></li>))}</ul></section>)}

      <section aria-labelledby="mem"><SectionTitle><span id="mem">Members ({active.length})</span></SectionTitle>
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">{active.map((m: any) => {
          const canManage = m.user_id !== a.user.id && m.role !== "owner" && a.canModerate && (isOwner || m.role === "member");
          return (
            <li key={m.user_id} className="card flex items-center gap-3.5 p-4">
              <Avatar name={m.profiles?.display_name ?? "?"} path={m.profiles?.avatar_path} size={48} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{m.profiles?.display_name ?? "Student"}{m.user_id === a.user.id && <span className="ml-1.5 text-xs font-medium text-muted">(you)</span>}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${ROLE_TONE[m.role]}`}>{m.role !== "member" && <ShieldCheck className="h-3 w-3" aria-hidden />}{m.role}</span>
                  {(m.profiles?.profile_badges ?? []).map((b: any) => <span key={b.badge_type} className="badge-success">{BADGES[b.badge_type]}</span>)}
                </div>
                <p className="mt-1 text-xs text-muted">Joined {formatDate(m.joined_at)}</p>
              </div>
              {m.user_id !== a.user.id && <StartChatButton userId={m.user_id} name={m.profiles?.display_name ?? "member"} variant="ghost" />}
              {canManage && (
                <details className="relative"><summary className="btn-ghost !min-h-[38px] !px-2.5 cursor-pointer list-none [&::-webkit-details-marker]:hidden" aria-label={`Actions for ${m.profiles?.display_name}`}><MoreHorizontal className="h-[18px] w-[18px]" aria-hidden /></summary>
                  <div className="absolute right-0 top-full z-30 mt-1 w-60 rounded-2xl border border-line bg-surface p-1.5 shadow-pop">
                    {isOwner && <ActionForm action={async () => { "use server"; return setRole(id, m.user_id, m.role === "moderator" ? "member" : "moderator"); }}><button className={menuItem}><ShieldCheck className="h-4 w-4" aria-hidden />{m.role === "moderator" ? "Make a regular member" : "Make moderator"}</button></ActionForm>}
                    {isOwner && <ActionForm action={async () => { "use server"; return setRole(id, m.user_id, "owner"); }} confirm={`Transfer ownership to ${m.profiles?.display_name}? You will become a moderator.`}><button className={menuItem}>Transfer ownership</button></ActionForm>}
                    <ActionForm action={async () => { "use server"; return removeMember(id, m.user_id); }} confirm="Remove this member?"><button className={`${menuItem} text-red-600 hover:!bg-red-50`}><UserMinus className="h-4 w-4" aria-hidden />Remove from group</button></ActionForm>
                  </div></details>)}
            </li>);
        })}</ul></section>
    </div>);
}
