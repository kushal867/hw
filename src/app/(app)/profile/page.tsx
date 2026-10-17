import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { AcademicPicker } from "@/components/academic-picker";
import { AvatarUpload } from "@/components/avatar-upload";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { PageHeader } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/server-db";
import { BADGES, formatDate, termName } from "@/lib/format";
import { updateProfile } from "@/app/actions/account";

export const metadata = { title: "Profile" };

export default async function ProfilePage() {
  const { profile, user } = await requireUser();
  const supabase = await createClient();
  const [colleges, courses, semesters, badges, mems, docs, posts, qs] = await Promise.all([
    supabase.from("colleges").select("id,name").order("name"),
    supabase.from("courses").select("id,name,college_id,term_label").order("name"),
    supabase.from("semesters").select("id,semester_number,academic_year,course_id").order("semester_number"),
    supabase.from("profile_badges").select("badge_type,awarded_at").eq("user_id", profile.id),
    supabase.from("semester_members").select("role,semesters(id,semester_number,courses(name,term_label))").eq("user_id", profile.id).eq("membership_status", "active"),
    supabase.from("documents").select("id", { count: "exact", head: true }).eq("uploaded_by", profile.id),
    supabase.from("discussion_posts").select("id", { count: "exact", head: true }).eq("author_id", profile.id),
    supabase.from("exam_questions").select("id", { count: "exact", head: true }).eq("created_by", profile.id),
  ]);
  return (
    <>
      <PageHeader title="Your profile" sub="Only your display name, photo and badges are visible to classmates. Your email stays private." />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="card p-5">
            <div className="mb-5 flex items-center gap-4"><Avatar name={profile.display_name} path={profile.avatar_path} size={64} /><div><p className="font-semibold">{profile.display_name}</p><p className="text-xs text-muted">{user.email}</p><div className="mt-2"><AvatarUpload /></div></div></div>
            <ActionForm action={updateProfile} className="grid gap-3 sm:grid-cols-2">
              <div><label htmlFor="display_name" className="label">Display name</label><input id="display_name" name="display_name" defaultValue={profile.display_name} required minLength={2} maxLength={60} className="input" /></div>
              <div><label htmlFor="username" className="label">Username (optional)</label><input id="username" name="username" defaultValue={profile.username ?? ""} pattern="[A-Za-z0-9_]{3,30}" className="input" /></div>
              <AcademicPicker colleges={colleges.data ?? []} courses={courses.data ?? []} semesters={semesters.data ?? []}
                initial={{ college: profile.college_id, course: profile.course_id, semester: profile.semester_id }} />
              <div><label htmlFor="preferred_language" className="label">Language</label><select id="preferred_language" name="preferred_language" defaultValue={profile.preferred_language} className="input"><option value="en">English</option><option value="ne">नेपाली</option></select></div>
              <div className="sm:col-span-2"><label htmlFor="bio" className="label">Short bio (optional)</label><textarea id="bio" name="bio" defaultValue={profile.bio ?? ""} maxLength={280} rows={3} className="input" /></div>
              <div className="sm:col-span-2"><SubmitButton>Save changes</SubmitButton></div>
            </ActionForm>
          </section>
        </div>
        <aside className="space-y-6">
          <section className="card p-5"><h2 className="mb-3 font-semibold">Contributions</h2>
            <dl className="grid grid-cols-3 text-center"><div><dt className="text-xs text-muted">PDFs</dt><dd className="text-xl font-bold">{docs.count ?? 0}</dd></div><div><dt className="text-xs text-muted">Posts</dt><dd className="text-xl font-bold">{posts.count ?? 0}</dd></div><div><dt className="text-xs text-muted">Questions</dt><dd className="text-xl font-bold">{qs.count ?? 0}</dd></div></dl></section>
          <section className="card p-5"><h2 className="mb-1 font-semibold">Badges</h2><p className="mb-3 text-xs text-muted">Earned automatically from helpful, unreported contributions. Badges are informational and don&apos;t imply college affiliation.</p>
            {!badges.data?.length ? <p className="text-sm text-muted">No badges yet.</p> : <ul className="flex flex-wrap gap-2">{badges.data.map((b) => <li key={b.badge_type} className="badge" title={`Earned ${formatDate(b.awarded_at)}`}>{BADGES[b.badge_type]}</li>)}</ul>}</section>
          <section className="card p-5"><h2 className="mb-3 font-semibold">My semesters</h2>
            {!mems.data?.length ? <p className="text-sm text-muted">You haven&apos;t joined any.</p> : <ul className="space-y-1 text-sm">{mems.data.map((m: any) => <li key={m.semesters.id}><Link className="text-brand-700 hover:underline" href={`/semesters/${m.semesters.id}`}>{m.semesters.courses?.name} · {termName(m.semesters.courses?.term_label, m.semesters.semester_number)}</Link> <span className="text-xs capitalize text-muted">({m.role})</span></li>)}</ul>}</section>
        </aside>
      </div>
    </>);
}
