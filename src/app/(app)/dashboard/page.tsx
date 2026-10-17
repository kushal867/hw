import { termName } from "@/lib/format";
import Link from "next/link";
import { Check, Circle, FileDown, MessagesSquare, QrCode, Upload, FileText } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/server-db";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Dashboard" };

export default async function Dashboard() {
  const { profile } = await requireUser();
  const supabase = await createClient();
  const { data: memberships } = await supabase.from("semester_members")
    .select("role, semesters(id, semester_number, academic_year, courses(name, term_label, colleges(name)))").eq("user_id", profile.id).eq("membership_status", "active");
  const semIds = (memberships ?? []).map((m: any) => m.semesters?.id).filter(Boolean);
  // RLS already limits these to the user's semesters; the in() filter just scopes the dashboard.
  const [docs, posts, qs] = semIds.length ? await Promise.all([
    supabase.from("documents").select("id,title,created_at,semester_id").in("semester_id", semIds).neq("moderation_status", "removed").order("created_at", { ascending: false }).limit(5),
    supabase.from("discussion_posts").select("id,title,created_at,semester_id").in("semester_id", semIds).eq("status", "visible").order("created_at", { ascending: false }).limit(5),
    supabase.from("exam_questions").select("id,question_text,created_at,semester_id").in("semester_id", semIds).eq("status", "visible").order("created_at", { ascending: false }).limit(5),
  ]) : [null, null, null];

  const steps = [
    { done: !!(profile.bio || profile.college_id || profile.avatar_path), label: "Complete your profile", href: "/profile" },
    { done: !!profile.college_id, label: "Find your college and course", href: "/colleges" },
    { done: semIds.length > 0, label: "Join a semester with a QR code or link", href: "/my-semesters" },
    { done: semIds.length > 0 && !!docs?.data?.length, label: "Upload or discover study materials", href: semIds[0] ? `/semesters/${semIds[0]}/files` : "/public-notes" },
  ];

  return (
    <>
      <PageHeader title={`Namaste, ${profile.display_name}`} sub="Here's what's happening in your semesters.">
        <Link href="/my-semesters" className="btn-secondary"><QrCode className="h-4 w-4" aria-hidden />Join Semester</Link>
        <Link href="/pdf-maker" className="btn-secondary"><FileDown className="h-4 w-4" aria-hidden />Create PDF</Link>
        {semIds[0] && <Link href={`/semesters/${semIds[0]}/files`} className="btn-primary"><Upload className="h-4 w-4" aria-hidden />Quick Upload</Link>}
      </PageHeader>

      {!semIds.length && (
        <section className="card mb-6 p-5" aria-labelledby="onb">
          <h2 id="onb" className="font-semibold">Get started</h2>
          <ol className="mt-3 space-y-2">
            {steps.map((s) => (
              <li key={s.label}><Link href={s.href} className="flex items-center gap-3 rounded-control px-2 py-2 text-sm hover:bg-brand-50">
                {s.done ? <Check className="h-4 w-4 text-success" aria-label="done" /> : <Circle className="h-4 w-4 text-muted" aria-label="to do" />}{s.label}</Link></li>))}
          </ol>
        </section>)}

      <section className="mb-8" aria-labelledby="ms"><h2 id="ms" className="mb-3 font-semibold">My Semesters</h2>
        {!memberships?.length ? <EmptyState icon={QrCode} title="You haven't joined a semester yet" action={<Link href="/my-semesters" className="btn-primary">Join or find a semester</Link>}>
          Ask your class owner for an invitation link or QR code, or browse colleges to find your semester.</EmptyState> : (
          <ul className="grid gap-4 sm:grid-cols-2">{memberships.map((m: any) => (
            <li key={m.semesters.id}><Link href={`/semesters/${m.semesters.id}`} className="card block p-5 hover:border-brand-200">
              <p className="text-xs text-muted">{m.semesters.courses?.colleges?.name}</p>
              <p className="font-semibold">{m.semesters.courses?.name} · {termName(m.semesters.courses?.term_label, m.semesters.semester_number)}</p>
              <span className="badge mt-2 capitalize">{m.role}</span></Link></li>))}</ul>)}
      </section>

      {semIds.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-3">
          <Recent title="Recent study materials" icon={FileText} empty="No files yet." items={(docs?.data ?? []).map((d) => ({ id: d.id, text: d.title, at: d.created_at, href: `/semesters/${d.semester_id}/files` }))} />
          <Recent title="Recent discussions" icon={MessagesSquare} empty="No discussions yet." items={(posts?.data ?? []).map((d) => ({ id: d.id, text: d.title, at: d.created_at, href: `/semesters/${d.semester_id}/discussions/${d.id}` }))} />
          <Recent title="Recently added questions" icon={FileText} empty="No questions yet." items={(qs?.data ?? []).map((d) => ({ id: d.id, text: d.question_text, at: d.created_at, href: `/semesters/${d.semester_id}/questions` }))} />
        </div>)}
    </>
  );
}

function Recent({ title, icon: Icon, items, empty }: { title: string; icon: typeof FileText; items: { id: string; text: string; at: string; href: string }[]; empty: string }) {
  return (
    <section className="card p-4" aria-label={title}>
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold"><Icon className="h-4 w-4 text-brand-600" aria-hidden />{title}</h3>
      {!items.length ? <p className="text-sm text-muted">{empty}</p> : (
        <ul className="space-y-2">{items.map((i) => (
          <li key={i.id}><Link href={i.href} className="block rounded-control p-2 hover:bg-brand-50"><span className="line-clamp-1 text-sm">{i.text}</span><span className="text-xs text-muted">{formatDate(i.at)}</span></Link></li>))}</ul>)}
    </section>
  );
}
