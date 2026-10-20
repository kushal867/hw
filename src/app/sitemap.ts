import type { MetadataRoute } from "next";
import { GUIDES } from "@/content/guides";
import { adminSql } from "@/lib/db";
import { isConfigured } from "@/lib/env";
import { abs } from "@/lib/seo";

// Generated from the database on request (never at build time). Only pages worth indexing are listed:
// a term or subject page with no subjects, notes or groups is left out so search engines don't see empty templates.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const entry = (path: string, priority: number, lastModified: Date | string = now, changeFrequency: "daily" | "weekly" | "monthly" = "weekly") =>
    ({ url: abs(path), lastModified: new Date(lastModified), changeFrequency, priority });
  const out: MetadataRoute.Sitemap = [
    entry("/", 1, now, "daily"), entry("/find-groups", 0.9, now, "daily"), entry("/public-notes", 0.9, now, "daily"), entry("/colleges", 0.8),
    entry("/guides", 0.8), entry("/about", 0.4, now, "monthly"), entry("/contact", 0.3, now, "monthly"), entry("/privacy", 0.2, now, "monthly"), entry("/terms", 0.2, now, "monthly"),
    ...GUIDES.map((g) => entry(`/guides/${g.slug}`, 0.7, g.updated, "monthly")),
  ];
  if (!isConfigured()) return out;
  try {
    const colleges = await adminSql<{ slug: string }>("select slug from colleges where status = 'active'");
    out.push(...colleges.map((c) => entry(`/colleges/${c.slug}`, 0.7)));
    const courses = await adminSql<{ college: string; slug: string }>(
      "select col.slug as college, c.slug from courses c join colleges col on col.id = c.college_id where c.status = 'active' and col.status = 'active'");
    out.push(...courses.map((c) => entry(`/colleges/${c.college}/${c.slug}`, 0.6)));
    // Terms that have something to show: subjects, a public note or a public group.
    const terms = await adminSql<{ college: string; course: string; n: number }>(
      `select distinct col.slug as college, c.slug as course, s.semester_number as n
         from semesters s join courses c on c.id = s.course_id join colleges col on col.id = c.college_id
        where s.status = 'active' and c.status = 'active' and col.status = 'active'
          and (exists (select 1 from subjects x where x.semester_id = s.id and x.status = 'active')
            or exists (select 1 from groups g where g.semester_id = s.id and g.visibility = 'public' and g.status = 'active')
            or exists (select 1 from public_notes pn where pn.semester_id = s.id))`);
    out.push(...terms.map((t) => entry(`/colleges/${t.college}/${t.course}/${t.n}`, 0.6)));
    const subjects = await adminSql<{ college: string; course: string; n: number; name: string; id: string }>(
      `select distinct col.slug as college, c.slug as course, s.semester_number as n, x.name, x.id
         from subjects x join semesters s on s.id = x.semester_id join courses c on c.id = s.course_id join colleges col on col.id = c.college_id
        where x.status = 'active' and exists (select 1 from public_notes pn where pn.subject_id = x.id)`);
    out.push(...subjects.map((s) => entry(`/colleges/${s.college}/${s.course}/${s.n}/${s.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || `s-${s.id.slice(0, 8)}`}`, 0.5)));
    const notes = await adminSql<{ id: string; published_at: string }>("select id, published_at from public_notes order by published_at desc limit 20000");
    out.push(...notes.map((n) => entry(`/public-notes/${n.id}`, 0.5, n.published_at, "monthly")));
    const groups = await adminSql<{ id: string; created_at: string }>("select id, created_at from group_directory order by created_at desc limit 20000");
    out.push(...groups.map((g) => entry(`/g/${g.id}`, 0.5, g.created_at, "weekly")));
  } catch { /* the database being briefly unavailable must not break the sitemap: serve the static part */ }
  return out;
}
