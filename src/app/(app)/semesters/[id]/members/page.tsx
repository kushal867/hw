import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { semesterAccess } from "@/lib/semester";
import { createClient } from "@/lib/supabase/server";
import { BADGES, formatDate } from "@/lib/format";
import { decideRequest, removeMember, setRole } from "@/app/actions/semesters";

export const metadata = { title: "Members" };

export default async function Members({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await semesterAccess(id);
  const supabase = await createClient();
  const { data: rows } = await supabase.from("semester_members").select("user_id, role, membership_status, joined_at, profiles(display_name, profile_badges:profile_badges(badge_type))")
    .eq("semester_id", id).neq("membership_status", "removed").order("joined_at");
  const active = (rows ?? []).filter((r: any) => r.membership_status === "active").sort((x: any, y: any) => ["owner", "moderator", "member"].indexOf(x.role) - ["owner", "moderator", "member"].indexOf(y.role));
  const pending = (rows ?? []).filter((r: any) => r.membership_status === "pending");
  const isOwner = a.role === "owner" || a.isAdmin;
  return (
    <div className="space-y-8">
      {a.canModerate && pending.length > 0 && (
        <section aria-labelledby="pend"><h2 id="pend" className="mb-3 font-semibold">Join requests ({pending.length})</h2>
          <ul className="space-y-2">{pending.map((m: any) => (
            <li key={m.user_id} className="card flex flex-wrap items-center justify-between gap-2 p-3 text-sm"><span>{m.profiles?.display_name ?? "Student"}</span>
              <span className="flex gap-2">
                <ActionForm action={async () => { "use server"; return decideRequest(id, m.user_id, true); }}><SubmitButton>Approve</SubmitButton></ActionForm>
                <ActionForm action={async () => { "use server"; return decideRequest(id, m.user_id, false); }}><SubmitButton variant="secondary">Decline</SubmitButton></ActionForm></span></li>))}</ul></section>)}
      <section aria-labelledby="mem"><h2 id="mem" className="mb-3 font-semibold">Members ({active.length})</h2>
        <ul className="space-y-2">{active.map((m: any) => (
          <li key={m.user_id} className="card flex flex-wrap items-center gap-3 p-3 text-sm">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-100 text-xs font-bold text-brand-700" aria-hidden>{(m.profiles?.display_name ?? "?").slice(0, 1).toUpperCase()}</span>
            <span className="font-medium">{m.profiles?.display_name ?? "Student"}</span><span className="badge capitalize">{m.role}</span>
            {(m.profiles?.profile_badges ?? []).map((b: any) => <span key={b.badge_type} className="badge !bg-success/10 !text-success">{BADGES[b.badge_type]}</span>)}
            <span className="text-xs text-muted">Joined {formatDate(m.joined_at)}</span>
            {m.user_id !== a.user.id && m.role !== "owner" && (
              <span className="ml-auto flex flex-wrap gap-2">
                {isOwner && <ActionForm action={async () => { "use server"; return setRole(id, m.user_id, m.role === "moderator" ? "member" : "moderator"); }}><SubmitButton variant="secondary">{m.role === "moderator" ? "Make member" : "Make moderator"}</SubmitButton></ActionForm>}
                {isOwner && <ActionForm action={async () => { "use server"; return setRole(id, m.user_id, "owner"); }} confirm={`Transfer ownership to ${m.profiles?.display_name}? You will become a moderator.`}><SubmitButton variant="secondary">Transfer ownership</SubmitButton></ActionForm>}
                {a.canModerate && (a.role === "owner" || a.isAdmin || m.role === "member") && <ActionForm action={async () => { "use server"; return removeMember(id, m.user_id); }} confirm="Remove this member?"><SubmitButton variant="danger">Remove</SubmitButton></ActionForm>}
              </span>)}
          </li>))}</ul></section>
    </div>);
}
