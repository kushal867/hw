import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/server-db";

/**
 * Loaders for the public, crawlable pages: college → course → term → subject.
 * They run as the anonymous/visitor role, so they can only ever see what row-level security makes public.
 * Each is wrapped in `cache` so generateMetadata and the page share one query.
 */
export const loadColleges = cache(async () => {
  const { data } = await (await createClient()).from("colleges").select("id,name,city,slug,logo_path").order("name");
  return (data ?? []) as { id: string; name: string; city: string | null; slug: string; logo_path: string | null }[];
});

export const loadCollege = cache(async (slug: string) => {
  const db = await createClient();
  const { data: college } = await db.from("colleges").select("id,name,city,slug,logo_path").eq("slug", slug).maybeSingle();
  if (!college) return null;
  const { data: courses } = await db.from("courses").select("id,name,slug,degree_level,term_label,semesters(id,semester_number,academic_year)").eq("college_id", college.id).order("name");
  return { college: college as unknown as { id: string; name: string; city: string | null; slug: string; logo_path: string | null }, courses: (courses ?? []) as any[] };
});

export const loadCourse = cache(async (collegeSlug: string, courseSlug: string) => {
  const c = await loadCollege(collegeSlug);
  const course = c?.courses.find((x) => x.slug === courseSlug);
  return c && course ? { college: c.college, course } : null;
});

export const loadTerm = cache(async (collegeSlug: string, courseSlug: string, n: number) => {
  const cc = await loadCourse(collegeSlug, courseSlug);
  if (!cc) return null;
  const { data: sem } = await (await createClient()).from("semesters").select("id,semester_number,academic_year,subjects(id,name,code)").eq("course_id", cc.course.id).eq("semester_number", n).maybeSingle();
  if (!sem) return null;
  const subjects = [...(sem.subjects ?? [])].sort((a: any, b: any) => a.name.localeCompare(b.name));
  return { ...cc, semester: { id: sem.id as string, number: sem.semester_number as number, academicYear: sem.academic_year as string | null }, subjects: subjects as { id: string; name: string; code: string | null }[] };
});

export { subjectSlug } from "@/lib/format";
import { subjectSlug } from "@/lib/format";

export const loadSubject = cache(async (collegeSlug: string, courseSlug: string, n: number, slug: string) => {
  const t = await loadTerm(collegeSlug, courseSlug, n);
  const subject = t?.subjects.find((s) => subjectSlug(s.name, s.id) === slug);
  return t && subject ? { ...t, subject } : null;
});

export const termHref = (collegeSlug: string, courseSlug: string, n: number) => `/colleges/${collegeSlug}/${courseSlug}/${n}`;

export const loadNotesFor = cache(async (filter: { semesterId?: string; subjectId?: string; courseId?: string; collegeId?: string }, limit = 12) => {
  let q = (await createClient()).from("public_notes").select("*").order("published_at", { ascending: false });
  if (filter.subjectId) q = q.eq("subject_id", filter.subjectId);
  else if (filter.semesterId) q = q.eq("semester_id", filter.semesterId);
  else if (filter.courseId) q = q.eq("course_id", filter.courseId);
  else if (filter.collegeId) q = q.eq("college_id", filter.collegeId);
  const { data } = await q.limit(limit);
  return (data ?? []) as any[];
});

export const loadGroupsFor = cache(async (filter: { semesterId?: string; courseId?: string; collegeId?: string }, limit = 9) => {
  let q = (await createClient()).from("group_directory").select("*").order("member_count", { ascending: false }).order("created_at", { ascending: false });
  if (filter.semesterId) q = q.eq("semester_id", filter.semesterId);
  else if (filter.courseId) q = q.eq("course_id", filter.courseId);
  else if (filter.collegeId) q = q.eq("college_id", filter.collegeId);
  const { data } = await q.limit(limit);
  return (data ?? []) as any[];
});
