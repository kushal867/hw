import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Runs only against a disposable database (migrations + supabase/tests/fixtures.sql loaded):  TEST_DATABASE_URL=postgres://... npm test
const url = process.env.TEST_DATABASE_URL;
const A = "00000000-0000-0000-0000-00000000000a"; // owner of group 1
const B = "00000000-0000-0000-0000-00000000000b"; // member of group 1
const C = "00000000-0000-0000-0000-00000000000c"; // outsider
const S1 = "30000000-0000-0000-0000-000000000001"; // semester 1
const G1 = "50000000-0000-0000-0000-000000000001"; // private group linked to semester 1
const G2 = "50000000-0000-0000-0000-000000000002"; // public, open
const G3 = "50000000-0000-0000-0000-000000000003"; // public, approval
const POST = "70000000-0000-0000-0000-000000000001";

describe.skipIf(!url)("query layer against Postgres + RLS", () => {
  let db: typeof import("@/lib/db");
  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    db = await import("@/lib/db");
    const admin = db.createAdminClient();
    await admin.from("profiles").update({ display_name: "Anita" }).eq("id", A);
    await admin.from("profiles").update({ display_name: "Bikash" }).eq("id", B);
  });
  afterAll(async () => { await (globalThis.__esPool as any)?.end(); });

  it("selects with nested embeds (to-one chain)", async () => {
    const { data, error } = await db.clientFor(B).from("semesters").select("id, semester_number, courses(id, name, colleges(id, name, slug))").eq("id", S1).maybeSingle();
    expect(error).toBeNull();
    expect(data.courses.name).toBe("BIT");
    expect(data.courses.colleges.slug).toBe("col");
  });

  it("embeds one-to-many and counts", async () => {
    const { data } = await db.createAdminClient().from("semesters").select("id, subjects(id, name)").eq("id", S1).single();
    expect(data.subjects.map((s: any) => s.name)).toEqual(["Programming"]);
    const { count } = await db.createAdminClient().from("subjects").select("id", { count: "exact", head: true }).eq("semester_id", S1);
    expect(count).toBe(1);
  });

  it("resolves FK embeds and an explicit FK hint", async () => {
    const { data } = await db.clientFor(A).from("documents").select("id, title, subjects(name), profiles(display_name)").eq("group_id", G1);
    expect(data.length).toBeGreaterThan(0);
    expect(data[0].profiles.display_name).toBe("Anita");
    const r = await db.createAdminClient().from("reports").select("*, reporter:profiles!reports_reporter_id_fkey(display_name)").limit(1);
    expect(r.error).toBeNull();
  });

  it("enforces RLS per user: members see private docs, outsiders and anonymous do not", async () => {
    const docs = (u: string | null) => db.clientFor(u).from("documents").select("id").eq("group_id", G1);
    expect((await docs(B)).data.length).toBeGreaterThan(0);
    expect((await docs(C)).data).toHaveLength(0);
    expect((await docs(null)).data ?? []).toHaveLength(0);
  });

  it("filters on embedded tables with !inner", async () => {
    const posts = [{ id: POST }];
    await db.createAdminClient().from("discussion_comments").insert({ post_id: posts[0].id, author_id: B, body: "reply" });
    const { data } = await db.createAdminClient().from("discussion_comments").select("id, discussion_posts!inner(group_id)").in("discussion_posts.group_id", [G1]);
    expect(data.length).toBe(1);
    const none = await db.createAdminClient().from("discussion_comments").select("id, discussion_posts!inner(group_id)").in("discussion_posts.group_id", [A]).then((r) => r);
    expect(none.data ?? []).toHaveLength(0);
    const withCount = await db.createAdminClient().from("discussion_posts").select("id, discussion_comments(count)").eq("id", posts[0].id).single();
    expect(withCount.data.discussion_comments[0].count).toBe(1);
  });

  it("insert/update/delete with returning select and single()", async () => {
    const admin = db.createAdminClient();
    const ins = await admin.from("colleges").insert({ name: "Test College", city: "Pokhara", slug: "test-college-pokhara" }).select("id").single();
    expect(ins.error).toBeNull();
    const dup = await admin.from("colleges").insert({ name: "Test College", city: "Pokhara", slug: "test-college-pokhara-2" });
    expect(dup.error?.code).toBe("23505");
    const upd = await admin.from("colleges").update({ city: "Lalitpur" }).eq("id", ins.data.id).select("city");
    expect(upd.data[0].city).toBe("Lalitpur");
    const del = await admin.from("colleges").delete().eq("id", ins.data.id).select("id");
    expect(del.data).toHaveLength(1);
    await expect(admin.from("colleges").delete().then((r) => { if (r.error) throw new Error(r.error.message); })).rejects.toThrow(/without a filter/);
  });

  it("users cannot write protected profile fields; column grants apply", async () => {
    const r = await db.clientFor(B).from("profiles").update({ platform_role: "admin" }).eq("id", B).select("id");
    expect(r.error).not.toBeNull();
    const ok = await db.clientFor(B).from("profiles").update({ bio: "hi" }).eq("id", B).select("id");
    expect(ok.error).toBeNull();
  });

  it("rpc returns jsonb / boolean results and surfaces raised errors", async () => {
    const allowed = await db.createAdminClient().rpc("check_rate_limit", { p_user: A, p_bucket: "t", p_max: 1, p_window_seconds: 60 });
    expect(allowed.data).toBe(true);
    const over = await db.createAdminClient().rpc("check_rate_limit", { p_user: A, p_bucket: "t", p_max: 1, p_window_seconds: 60 });
    expect(over.data).toBe(false);
    const bad = await db.createAdminClient().rpc("set_member_role", { p_actor: B, p_group: G1, p_target: A, p_role: "member" });
    expect(bad.error?.message).toMatch(/forbidden|owner/i);
    const inv = await db.createAdminClient().rpc("redeem_invite", { p_token_hash: "nope", p_user: C });
    expect(inv.data.status).toBeTruthy();
  });

  it("returns timestamps as ISO strings", async () => {
    const { data } = await db.clientFor(A).from("group_members").select("joined_at").eq("user_id", A).limit(1);
    expect(typeof data[0].joined_at).toBe("string");
    expect(new Date(data[0].joined_at).toISOString()).toBe(data[0].joined_at);
  });

  // ───────── Groups (any student can create / join) ─────────
  it("creates a group through the trusted function; creator becomes owner; embeds resolve", async () => {
    const admin = db.createAdminClient();
    const made = await admin.rpc("create_group", { p_user: C, p_name: "C's homework group", p_desc: "hw", p_semester: S1, p_visibility: "public", p_policy: "open" });
    expect(made.error).toBeNull();
    const gid = made.data as string;
    const row = await db.clientFor(C).from("groups").select("id, name, profiles!groups_created_by_fkey(display_name), semesters(semester_number, courses(name, term_label, colleges(name)))").eq("id", gid).single();
    expect(row.error).toBeNull();
    expect(row.data.semesters.courses.term_label).toBe("Semester");
    const mine = await db.clientFor(C).from("group_members").select("role, groups(id, name, status)").eq("user_id", C).eq("group_id", gid).single();
    expect(mine.data.role).toBe("owner");
    expect(mine.data.groups.name).toBe("C's homework group");
  });

  it("normal users cannot call create_group / join_group directly", async () => {
    // the query layer only exposes rpc through the service role in app code; as an end-user role the function is not executable
    const r = await db.clientFor(C).rpc("create_group", { p_user: C, p_name: "sneaky group", p_desc: null, p_semester: null, p_visibility: "public", p_policy: "open" });
    expect(r.error).not.toBeNull();
  });

  it("directory shows public groups to anonymous users, never private ones", async () => {
    const anon = await db.clientFor(null).from("group_directory").select("id, name, member_count").order("name");
    expect(anon.error).toBeNull();
    const names = anon.data.map((g: any) => g.name);
    expect(names).toContain("Open hw group");
    expect(names).not.toContain("Private class");
    const denied = await db.clientFor(null).from("groups").select("id");
    expect(denied.error).not.toBeNull();            // the raw table is closed to anonymous users
  });

  it("join_group: open joins instantly, approval stays pending, private is refused", async () => {
    const admin = db.createAdminClient();
    const D = "00000000-0000-0000-0000-00000000000d";
    await admin.from("profiles").insert({ id: D, display_name: "Dina" }).then(() => {}, () => {});
    expect((await admin.rpc("join_group", { p_user: C, p_group: G2 })).data.status).toBe("joined");
    expect((await admin.rpc("join_group", { p_user: C, p_group: G3 })).data.status).toBe("pending");
    expect((await admin.rpc("join_group", { p_user: C, p_group: G1 })).data.status).toBe("invalid");
    // a pending member still cannot read the group's content
    const posts = await db.clientFor(C).from("discussion_posts").select("id").eq("group_id", G1);
    expect(posts.data ?? []).toHaveLength(0);
    // owner approves → active
    await admin.rpc("decide_join_request", { p_actor: A, p_group: G3, p_target: C, p_approve: true });
    const m = await db.clientFor(C).from("group_members").select("membership_status").eq("group_id", G3).eq("user_id", C).single();
    expect(m.data.membership_status).toBe("active");
  });

  it("owners edit their group; members and outsiders cannot; protected fields are locked", async () => {
    const ok = await db.clientFor(A).from("groups").update({ description: "updated" }).eq("id", G2).select("id");
    expect(ok.data).toHaveLength(1);
    const noRows = await db.clientFor(B).from("groups").update({ description: "hijack" }).eq("id", G2).select("id");
    expect(noRows.data ?? []).toHaveLength(0);
    const locked = await db.clientFor(A).from("groups").update({ status: "archived" }).eq("id", G2).select("id");
    expect(locked.error).not.toBeNull();
  });

  it("subject tags must belong to the group's linked semester", async () => {
    const admin = db.createAdminClient();
    const bad = await admin.from("discussion_posts").insert({ group_id: G2, subject_id: "40000000-0000-0000-0000-000000000001", author_id: A, title: "tagged", body: "x" });
    expect(bad.error).not.toBeNull();               // G2 is unlinked, so it has no subjects
    const wrongSem = await admin.from("discussion_posts").insert({ group_id: G1, subject_id: "40000000-0000-0000-0000-000000000002", author_id: B, title: "tagged", body: "x" });
    expect(wrongSem.error).not.toBeNull();           // subject belongs to semester 2, G1 is linked to semester 1
    const good = await admin.from("discussion_posts").insert({ group_id: G1, subject_id: "40000000-0000-0000-0000-000000000001", author_id: B, title: "tagged ok", body: "x" });
    expect(good.error).toBeNull();
  });
});
