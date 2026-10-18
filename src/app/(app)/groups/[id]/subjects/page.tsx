import Link from "next/link";
import { Library } from "lucide-react";
import { EmptyState } from "@/components/ui/misc";
import { groupAccess, loadGroup } from "@/lib/group";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Subjects" };

export default async function Subjects({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await groupAccess(id);
  const group = await loadGroup(id);
  if (!group?.semester_id) return <EmptyState icon={Library} title="This group isn't linked to a semester">Only groups linked to a college semester have subjects.</EmptyState>;
  const { data } = await (await createClient()).from("subjects").select("id,name,code").eq("semester_id", group.semester_id).order("name");
  if (!data?.length) return <EmptyState icon={Library} title="No subjects yet">An administrator adds subjects for each semester.</EmptyState>;
  return <ul className="grid gap-3 sm:grid-cols-2">{data.map((s) => (
    <li key={s.id}><Link className="card block p-4 hover:border-brand-200" href={`/subjects/${s.id}`}><p className="font-semibold">{s.name}</p>{s.code && <p className="text-xs text-muted">{s.code}</p>}</Link></li>))}</ul>;
}
