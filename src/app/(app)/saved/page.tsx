import Link from "next/link";
import { Bookmark } from "lucide-react";
import { NoteCard } from "@/components/public/cards";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/server-db";

export const metadata = { title: "Saved notes" };

export default async function Saved() {
  const { user } = await requireUser();
  const db = await createClient();
  const { data: saves } = await db.from("note_saves").select("document_id,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(100);
  const ids = (saves ?? []).map((s: any) => s.document_id);
  // Notes that were un-published since being saved simply drop out: public_notes only lists what is still public.
  const { data: notes } = ids.length ? await db.from("public_notes").select("*").in("id", ids) : { data: [] as any[] };
  const byId = new Map((notes ?? []).map((n: any) => [n.id, n]));
  const ordered = ids.map((id: string) => byId.get(id)).filter(Boolean);
  return (<>
    <PageHeader title="Saved notes" sub="Public notes you bookmarked. Only you can see this list." />
    {!ordered.length ? <EmptyState icon={Bookmark} title="Nothing saved yet" action={<Link href="/public-notes" className="btn-primary">Browse public notes</Link>}>Tap Save on any public note to keep it here.</EmptyState>
      : <ul className="grid gap-4 md:grid-cols-2">{ordered.map((n: any) => <li key={n.id}><NoteCard n={n} /></li>)}</ul>}
  </>);
}
