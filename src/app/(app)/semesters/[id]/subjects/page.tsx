import Link from "next/link";
import { Library } from "lucide-react";
import { EmptyState } from "@/components/ui/misc";
import { semesterAccess } from "@/lib/semester";
import { createClient } from "@/lib/server-db";

export const metadata = { title: "Subjects" };

export default async function Subjects({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await semesterAccess(id);
  const { data } = await (await createClient()).from("subjects").select("id,name,code").eq("semester_id", id).order("name");
  if (!data?.length) return <EmptyState icon={Library} title="No subjects yet">An administrator adds subjects for each semester.</EmptyState>;
  return <ul className="grid gap-3 sm:grid-cols-2">{data.map((s) => (
    <li key={s.id}><Link className="card block p-4 hover:border-brand-200" href={`/subjects/${s.id}`}><p className="font-semibold">{s.name}</p>{s.code && <p className="text-xs text-muted">{s.code}</p>}</Link></li>))}</ul>;
}
