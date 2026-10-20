import { CalendarDays, Trash2 } from "lucide-react";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { EventRow } from "@/components/event-row";
import { EmptyState } from "@/components/ui/misc";
import { groupAccess } from "@/lib/group";
import { EVENT_KINDS } from "@/lib/format";
import { createClient } from "@/lib/server-db";
import { createEvent, deleteEvent } from "@/app/actions/events";

export const metadata = { title: "Events" };

export default async function Events({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await groupAccess(id);
  const db = await createClient();
  const now = new Date().toISOString();
  const [{ data: upcoming }, { data: past }] = await Promise.all([
    db.from("group_events").select("id,title,description,kind,starts_at").eq("group_id", id).gte("starts_at", now).order("starts_at").limit(100),
    db.from("group_events").select("id,title,description,kind,starts_at").eq("group_id", id).lt("starts_at", now).order("starts_at", { ascending: false }).limit(10),
  ]);
  const del = (e: any) => a.canModerate ? (
    <ActionForm action={async () => { "use server"; return deleteEvent(id, e.id); }} confirm="Delete this event?"><SubmitButton variant="ghost" className="!min-h-[36px] !px-2"><Trash2 className="h-4 w-4" aria-hidden /><span className="sr-only">Delete event</span></SubmitButton></ActionForm>) : null;
  return (
    <div className="space-y-6">
      {a.canModerate && (
        <details className="card group">
          <summary className="flex cursor-pointer list-none items-center gap-3 p-4 [&::-webkit-details-marker]:hidden">
            <span aria-hidden className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-600"><CalendarDays className="h-5 w-5" /></span>
            <span><span className="block font-bold">Add an exam, deadline or class</span><span className="block text-xs text-muted">Members are notified now and reminded the day before.</span></span>
          </summary>
          <ActionForm action={createEvent.bind(null, id)} resetOnSuccess className="grid gap-4 border-t border-line p-5 sm:grid-cols-2">
            <div className="sm:col-span-2"><label htmlFor="title" className="label">Title</label><input id="title" name="title" required minLength={3} maxLength={120} className="input" placeholder="e.g. Data Structures midterm" /></div>
            <div><label htmlFor="kind" className="label">Type</label><select id="kind" name="kind" className="input" defaultValue="exam">{Object.entries(EVENT_KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
            <div><label htmlFor="when" className="label">Date and time (Nepal time)</label><input id="when" name="when" type="datetime-local" required className="input" /></div>
            <div className="sm:col-span-2"><label htmlFor="description" className="label">Details <span className="font-normal text-muted">(optional)</span></label><textarea id="description" name="description" rows={2} maxLength={500} className="input" placeholder="Room, syllabus covered, what to bring…" /></div>
            <div className="sm:col-span-2"><SubmitButton className="btn-lg">Add to calendar</SubmitButton></div>
          </ActionForm>
        </details>)}
      <section aria-labelledby="up"><h2 id="up" className="mb-3 text-lg font-extrabold">Upcoming</h2>
        {!upcoming?.length ? <EmptyState icon={CalendarDays} title="Nothing scheduled">{a.canModerate ? "Add the next exam, assignment deadline or class so everyone sees it on their dashboard." : "When a moderator adds an exam or deadline, it will show up here and on your dashboard."}</EmptyState>
          : <ul className="card divide-y divide-line">{upcoming.map((e: any) => <li key={e.id}><EventRow e={e} action={del(e)} /></li>)}</ul>}
      </section>
      {!!past?.length && <section aria-labelledby="pa"><h2 id="pa" className="mb-3 text-lg font-extrabold text-slate-500">Past</h2>
        <ul className="card divide-y divide-line opacity-80">{past.map((e: any) => <li key={e.id}><EventRow e={e} past action={del(e)} /></li>)}</ul></section>}
    </div>
  );
}
