import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Needs a disposable database with migrations + supabase/tests/fixtures.sql:  TEST_DATABASE_URL=postgres://... npm test
const url = process.env.TEST_DATABASE_URL;
const A = "00000000-0000-0000-0000-00000000000a"; // owner of G1 (private, linked to semester 1)
const B = "00000000-0000-0000-0000-00000000000b"; // member of G1
const C = "00000000-0000-0000-0000-00000000000c"; // outsider
const G1 = "50000000-0000-0000-0000-000000000001";
const DOC = "60000000-0000-0000-0000-000000000001";

describe.skipIf(!url)("public content, saved notes and events through the query layer", () => {
  let db: typeof import("@/lib/db");
  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    db = await import("@/lib/db");
  });
  afterAll(async () => { await (globalThis.__esPool as any)?.end(); });

  it("a published note appears in public_notes with slugs and counters; hits are counted by the server only", async () => {
    const admin = db.createAdminClient();
    await admin.from("documents").update({ visibility: "public", moderation_status: "approved", published_at: new Date().toISOString(), subject_id: "40000000-0000-0000-0000-000000000001" }).eq("id", DOC);
    const { data } = await db.clientFor(null).from("public_notes").select("id,subject_slug,view_count,download_count,college_slug,course_slug,semester_number").eq("id", DOC).single();
    expect(data).toMatchObject({ subject_slug: "programming", college_slug: "col", course_slug: "bit", semester_number: 1, view_count: 0 });
    await admin.rpc("record_note_hit", { p_doc: DOC, p_kind: "view" });
    await admin.rpc("record_note_hit", { p_doc: DOC, p_kind: "download" });
    const after = await db.clientFor(null).from("public_notes").select("view_count,download_count").eq("id", DOC).single();
    expect(after.data).toMatchObject({ view_count: 1, download_count: 1 });
    const denied = await db.clientFor(A).rpc("record_note_hit", { p_doc: DOC, p_kind: "view" });
    expect(denied.error).not.toBeNull();
    const inflate = await db.clientFor(A).from("documents").update({ view_count: 9999 }).eq("id", DOC).select("id");
    expect(inflate.error).not.toBeNull();
  });

  it("saved notes are private to their owner, deduplicated, and only for public notes", async () => {
    const save = await db.clientFor(C).from("note_saves").insert({ user_id: C, document_id: DOC });
    expect(save.error).toBeNull();
    const dup = await db.clientFor(C).from("note_saves").insert({ user_id: C, document_id: DOC });
    expect(dup.error?.code).toBe("23505");
    expect((await db.clientFor(C).from("note_saves").select("document_id").eq("user_id", C)).data).toHaveLength(1);
    expect((await db.clientFor(B).from("note_saves").select("document_id")).data).toHaveLength(0);
    const spoof = await db.clientFor(B).from("note_saves").insert({ user_id: C, document_id: DOC });
    expect(spoof.error).not.toBeNull();
    const del = await db.clientFor(C).from("note_saves").delete().eq("user_id", C).eq("document_id", DOC).select("document_id");
    expect(del.data).toHaveLength(1);
  });

  it("moderators create events; members read them with the group embedded; outsiders see nothing", async () => {
    const soon = new Date(Date.now() + 3 * 3600_000).toISOString(), later = new Date(Date.now() + 5 * 86400_000).toISOString();
    expect((await db.clientFor(A).from("group_events").insert({ group_id: G1, title: "Midterm", kind: "exam", starts_at: later, created_by: A })).error).toBeNull();
    expect((await db.createAdminClient().from("group_events").insert({ group_id: G1, title: "Quiz soon", kind: "exam", starts_at: soon, created_by: A })).error).toBeNull();
    const member = await db.clientFor(B).from("group_events").select("id,title,kind,starts_at,groups(name)").eq("group_id", G1).gte("starts_at", new Date().toISOString()).order("starts_at");
    expect(member.error).toBeNull();
    expect(member.data.map((e: any) => e.title)).toEqual(["Quiz soon", "Midterm"]);
    expect(member.data[0].groups.name).toBe("Private class");
    expect((await db.clientFor(B).from("group_events").insert({ group_id: G1, title: "Member event", kind: "other", starts_at: later, created_by: B })).error).not.toBeNull();
    expect((await db.clientFor(C).from("group_events").select("id")).data).toHaveLength(0);
    const past = await db.clientFor(B).from("group_events").select("id").eq("group_id", G1).lt("starts_at", new Date().toISOString());
    expect(past.data).toHaveLength(0);
  });

  it("the reminder job notifies every active member once", async () => {
    const admin = db.createAdminClient();
    const first = await admin.rpc("run_event_reminders");
    expect(first.error).toBeNull();
    expect(first.data).toBeGreaterThanOrEqual(2);                                 // A and B
    const notes = await db.clientFor(B).from("notifications").select("title,destination").eq("notification_type", "event");
    expect(notes.data.some((n: any) => n.title.includes("Quiz soon") && n.destination === `/groups/${G1}/events`)).toBe(true);
    expect((await admin.rpc("run_event_reminders")).data).toBe(0);
    expect((await db.clientFor(A).rpc("run_event_reminders")).error).not.toBeNull();
  });

  it("group_directory exposes course info for linking and never lists private groups", async () => {
    const { data } = await db.clientFor(null).from("group_directory").select("id,course_id,course_slug,member_count");
    expect(data.some((g: any) => g.id === G1)).toBe(false);
    expect(data.length).toBeGreaterThan(0);
    expect(Object.keys(data[0])).toEqual(expect.arrayContaining(["course_id", "course_slug"]));
  });
});
