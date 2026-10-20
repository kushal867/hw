import { describe, expect, it } from "vitest";
import { GUIDES, guideBySlug } from "@/content/guides";
import { nepalLocalToDate, slugify, subjectSlug, whenLabel } from "@/lib/format";
import { ogImage, trimDescription } from "@/lib/seo";

describe("guides", () => {
  it("have unique slugs, valid related links and real content", () => {
    const slugs = GUIDES.map((g) => g.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const g of GUIDES) {
      expect(g.related.every((r) => !!guideBySlug(r) && r !== g.slug), `${g.slug} related`).toBe(true);
      expect(g.sections.length).toBeGreaterThanOrEqual(4);
      expect(g.sections.every((s) => (s.paragraphs?.length ?? 0) + (s.bullets?.length ?? 0) + (s.steps?.length ?? 0) > 0), `${g.slug} empty section`).toBe(true);
      expect(g.description.length, `${g.slug} description length`).toBeLessThanOrEqual(170);
      expect(new Set(g.sections.map((s) => slugify(s.heading))).size, `${g.slug} duplicate heading ids`).toBe(g.sections.length);
      const words = [g.intro, ...g.sections.flatMap((s) => [...(s.paragraphs ?? []), ...(s.bullets ?? []), ...(s.steps ?? [])])].join(" ").split(/\s+/).length;
      expect(words, `${g.slug} is too thin`).toBeGreaterThan(400);
    }
  });
});

describe("seo helpers", () => {
  it("keeps short descriptions and cuts long ones at a word boundary", () => {
    expect(trimDescription("Short text")).toBe("Short text");
    const long = trimDescription("word ".repeat(80));
    expect(long.length).toBeLessThanOrEqual(158);
    expect(long.endsWith("…")).toBe(true);
    expect(long.endsWith(" …")).toBe(false);
  });
  it("builds a bounded, encoded share-image URL", () => {
    const u = new URL(ogImage("A & B ".repeat(40), "sub"));
    expect(u.pathname).toBe("/og");
    expect(u.searchParams.get("title")!.length).toBeLessThanOrEqual(90);
  });
});

describe("Nepal time", () => {
  it("interprets datetime-local input as UTC+05:45", () => {
    expect(nepalLocalToDate("2026-11-05T10:00")?.toISOString()).toBe("2026-11-05T04:15:00.000Z");
    expect(nepalLocalToDate("2026-11-05")).toBeNull();
    expect(nepalLocalToDate("garbage")).toBeNull();
    expect(nepalLocalToDate("2026-13-45T10:00")).toBeNull();
  });
  it("labels days by Nepal calendar day, not 24-hour blocks", () => {
    const now = new Date("2026-10-20T00:30:00+05:45");                       // just after midnight in Nepal
    expect(whenLabel("2026-10-20T23:50:00+05:45", now)).toBe("Today");
    expect(whenLabel("2026-10-21T00:05:00+05:45", now)).toBe("Tomorrow");   // only 23h35m away, but the next calendar day
    expect(whenLabel("2026-10-25T09:00:00+05:45", now)).toBe("In 5 days");
    expect(whenLabel("2026-10-19T22:00:00+05:45", now)).toBe("Yesterday");
    expect(whenLabel("2026-10-15T09:00:00+05:45", now)).toBe("5 days ago");
  });
});

describe("subject slugs (must match public.subject_slug in SQL)", () => {
  it("slugifies latin names and falls back for other scripts", () => {
    expect(subjectSlug("Data Structures & Algorithms", "40000000-0000-0000-0000-000000000001")).toBe("data-structures-algorithms");
    expect(subjectSlug("C Programming", "x")).toBe("c-programming");
    expect(subjectSlug("डाटा स्ट्रक्चर", "40000000-0000-0000-0000-000000000002")).toBe("s-40000000");
  });
});
