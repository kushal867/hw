import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";

// Needs a disposable database with all migrations + supabase/tests/fixtures.sql:  TEST_DATABASE_URL=postgres://... npm test
const url = process.env.TEST_DATABASE_URL;
// This file creates its OWN users and groups so it can never interfere with (or be broken by) other test files sharing the database.
let A = "", B = "", C = "", G1 = "", G2 = "";          // A owns G1 + G2, B is a member of G1, C shares no group with anyone

describe.skipIf(!url)("chat backend against Postgres + RLS", () => {
  let db: typeof import("@/lib/db");
  let q: typeof import("@/lib/chat/queries");
  let g1Room: string;
  const sent: string[] = [];

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    db = await import("@/lib/db");
    q = await import("@/lib/chat/queries");
    const admin = db.createAdminClient();
    const mk = async (name: string) => {
      const id = crypto.randomUUID();
      await db.adminSql("insert into auth.users (id, email) values ($1, $2)", [id, `${name.toLowerCase()}-${id}@test.local`]);
      await admin.from("profiles").update({ display_name: name }).eq("id", id);
      return id;
    };
    [A, B, C] = [await mk("Anita"), await mk("Bikash"), await mk("Chandra")];
    const mkGroup = async (name: string, vis: string, policy: string) => (await admin.rpc("create_group", { p_user: A, p_name: name, p_desc: null, p_semester: null, p_visibility: vis, p_policy: policy })).data as unknown as string;
    G1 = await mkGroup("Chat test private group", "private", "invite_only");
    G2 = await mkGroup("Chat test public group", "public", "open");
    await admin.from("group_members").insert({ group_id: G1, user_id: B, role: "member", membership_status: "active" });
    g1Room = (await q.roomIdForGroup(A, G1))!;
  });
  afterAll(async () => { await (globalThis.__esPool as any)?.end(); });

  const send = async (user: string, body: string, extra: Record<string, unknown> = {}) => {
    const r = await db.clientFor(user).from("chat_messages").insert({ room_id: g1Room, sender_id: user, body, client_id: crypto.randomUUID(), ...extra }).select(q.MESSAGE_SELECT).single();
    if (r.error) throw new Error(r.error.message);
    sent.push(r.data.id);
    return q.shapeMessage(r.data, user);
  };

  it("every group has exactly one chat room, visible to members only", async () => {
    expect(g1Room).toBeTruthy();
    expect(await q.roomIdForGroup(B, G1)).toBe(g1Room);
    expect(await q.roomIdForGroup(C, G1)).toBeNull();                       // outsider: RLS hides the room
  });

  it("sends, shapes and embeds sender / reply / reactions", async () => {
    const first = await send(A, "Welcome to the group chat");
    expect(first.sender).toMatchObject({ id: A, name: "Anita" });
    const reply = await send(B, "Thanks Anita!", { reply_to: first.id });
    expect(reply.replyTo).toMatchObject({ id: first.id, senderName: "Anita", deleted: false });
    expect(reply.replyTo?.preview).toBe("Welcome to the group chat");
    await db.clientFor(A).from("chat_reactions").insert({ message_id: reply.id, user_id: A, emoji: "love" });
    await db.clientFor(B).from("chat_reactions").insert({ message_id: reply.id, user_id: B, emoji: "love" });
    const { messages } = await q.listMessages(A, g1Room, { id: reply.id });
    expect(messages[0].reactions).toEqual([{ emoji: "love", count: 2, mine: true }]);
    expect((await q.listMessages(B, g1Room, { id: reply.id })).messages[0].reactions[0].mine).toBe(true);
  });

  it("paginates: latest page, before (older), after (catch-up) with hasMore", async () => {
    for (let i = 1; i <= 12; i++) await send(i % 2 ? A : B, `bulk ${i}`);
    const latest = await q.listMessages(A, g1Room, { limit: 5 });
    expect(latest.messages).toHaveLength(5);
    expect(latest.hasMore).toBe(true);
    expect(latest.messages.map((m) => m.body).slice(-1)[0]).toBe("bulk 12");
    const seqs = latest.messages.map((m) => m.seq);
    expect([...seqs].sort((a, b) => a - b)).toEqual(seqs);                  // ascending for rendering
    const older = await q.listMessages(A, g1Room, { before: seqs[0], limit: 5 });
    expect(Math.max(...older.messages.map((m) => m.seq))).toBeLessThan(seqs[0]);
    const newer = await q.listMessages(A, g1Room, { after: older.messages[0].seq, limit: 3 });
    expect(newer.messages).toHaveLength(3);
    expect(newer.messages[0].seq).toBeGreaterThan(older.messages[0].seq);
    const all = await q.listMessages(A, g1Room, { after: 0, limit: 100 });
    expect(all.hasMore).toBe(false);
  });

  it("an outsider can read nothing and send nothing", async () => {
    expect((await q.listMessages(C, g1Room, {})).messages).toHaveLength(0);
    const r = await db.clientFor(C).from("chat_messages").insert({ room_id: g1Room, sender_id: C, body: "let me in" }).select("id").single();
    expect(r.error?.code).toBe("42501");
    expect(await q.getRoomInfo(C, g1Room)).toBeNull();
  });

  it("the same client_id can never create a duplicate (idempotent retry)", async () => {
    const clientId = crypto.randomUUID();
    const first = await db.clientFor(A).from("chat_messages").insert({ room_id: g1Room, sender_id: A, body: "once", client_id: clientId }).select("id").single();
    expect(first.error).toBeNull();
    const again = await db.clientFor(A).from("chat_messages").insert({ room_id: g1Room, sender_id: A, body: "once", client_id: clientId }).select("id").single();
    expect(again.error?.code).toBe("23505");
  });

  it("edit and delete rules hold; deleted text is erased and shaped as null", async () => {
    const m = await send(B, "typo here");
    const edit = await db.clientFor(B).from("chat_messages").update({ body: "fixed" }).eq("id", m.id).select(q.MESSAGE_SELECT).single();
    expect(q.shapeMessage(edit.data, B)).toMatchObject({ body: "fixed" });
    expect(q.shapeMessage(edit.data, B).editedAt).not.toBeNull();
    const hijack = await db.clientFor(A).from("chat_messages").update({ body: "tampered" }).eq("id", m.id).select("id");
    expect(hijack.error?.code).toBe("42501");                               // even the group owner can't rewrite someone's words
    const del = await db.clientFor(A).from("chat_messages").update({ deleted_at: new Date().toISOString() }).eq("id", m.id).select(q.MESSAGE_SELECT).single();
    const shaped = q.shapeMessage(del.data, A);
    expect(shaped.body).toBeNull(); expect(shaped.deletedAt).not.toBeNull();
    const raw = await db.adminSql("select body, deleted_by from chat_messages where id = $1", [m.id]);
    expect(raw[0]).toEqual({ body: null, deleted_by: A });                  // erased at rest, not just hidden
    const reply = await send(A, "replying to a deleted one", { reply_to: m.id });
    expect(reply.replyTo).toMatchObject({ deleted: true, preview: null });
  });

  it("room info reports who can send and why not", async () => {
    const info = await q.getRoomInfo(B, g1Room);
    expect(info).toMatchObject({ kind: "group", title: expect.any(String), canSend: true, isMod: false, groupId: G1 });
    expect((await q.getRoomInfo(A, g1Room))?.isMod).toBe(true);
    const roomG2 = (await q.roomIdForGroup(A, G2))!;
    await db.createAdminClient().from("groups").update({ status: "archived" }).eq("id", G2);
    const archived = await q.getRoomInfo(A, roomG2);
    expect(archived).toMatchObject({ canSend: false });
    expect(archived?.sendBlockedReason).toMatch(/archived/);
    await db.createAdminClient().from("groups").update({ status: "active" }).eq("id", G2);
  });

  it("direct messages: open, inbox, unread, read-state, block", async () => {
    const admin = db.createAdminClient();
    const opened = await admin.rpc("chat_open_direct", { p_user: A, p_other: B });
    expect(opened.error).toBeNull();
    const dm = opened.data as unknown as string;
    expect((await admin.rpc("chat_open_direct", { p_user: B, p_other: A })).data).toBe(dm);
    const stranger = await admin.rpc("chat_open_direct", { p_user: A, p_other: C });
    expect(stranger.error?.code).toBe("42501");                             // C shares no group with A

    const ins = await db.clientFor(A).from("chat_messages").insert({ room_id: dm, sender_id: A, body: "psst, got the notes?" }).select("seq").single();
    expect(ins.error).toBeNull();
    const info = await q.getRoomInfo(B, dm);
    expect(info).toMatchObject({ kind: "direct", title: "Anita", otherUserId: A, canSend: true, blockedByMe: false });

    const inbox = await q.listInbox(B);
    const dmRow = inbox.find((r) => r.id === dm)!;
    expect(dmRow).toMatchObject({ kind: "direct", title: "Anita", unread: 1, lastBody: "psst, got the notes?" });
    expect(inbox.find((r) => r.id === g1Room)).toMatchObject({ kind: "group" });
    expect((await q.listInbox(C)).find((r) => r.id === dm)).toBeUndefined();   // not a participant
    expect((await q.unreadFor(B)).find((r) => r.roomId === dm)?.unread).toBe(1);

    expect((await db.clientFor(B).rpc("chat_mark_read", { p_room: dm, p_seq: ins.data.seq })).error).toBeNull();
    expect((await q.unreadFor(B)).find((r) => r.roomId === dm)?.unread).toBe(0);

    await db.clientFor(B).from("user_blocks").insert({ blocker_id: B, blocked_id: A });
    expect((await q.getRoomInfo(B, dm))).toMatchObject({ canSend: false, blockedByMe: true });
    const blockedSend = await db.clientFor(A).from("chat_messages").insert({ room_id: dm, sender_id: A, body: "hello?" }).select("id").single();
    expect(blockedSend.error?.code).toBe("42501");
    await db.clientFor(B).from("user_blocks").delete().eq("blocker_id", B);
  });

  it("platform admins cannot read DMs; they can moderate group chats", async () => {
    const admin = db.createAdminClient();
    await admin.from("profiles").update({ platform_role: "admin" }).eq("id", C);
    const dm = (await admin.rpc("chat_open_direct", { p_user: A, p_other: B })).data as unknown as string;
    expect((await q.listMessages(C, dm, {})).messages).toHaveLength(0);
    expect((await q.listMessages(C, g1Room, {})).messages.length).toBeGreaterThan(0);
    await admin.from("profiles").update({ platform_role: "user" }).eq("id", C);
  });

  it("database triggers NOTIFY with ids only — message text never leaves over the wire", async () => {
    const listener = new Client({ connectionString: url });
    await listener.connect(); await listener.query("LISTEN chat");
    const got: any[] = [];
    listener.on("notification", (n) => got.push(JSON.parse(n.payload!)));
    const m = await send(A, "super secret plaintext");
    await db.clientFor(B).from("chat_reactions").insert({ message_id: m.id, user_id: B, emoji: "party" });
    await db.clientFor(A).from("chat_messages").update({ body: "edited secret" }).eq("id", m.id);
    await db.adminSql("select pg_notify('chat', $1)", [JSON.stringify({ t: "typing", room: g1Room, user: B, name: "Bikash" })]);
    await new Promise((r) => setTimeout(r, 300));
    await listener.end();
    const kinds = got.map((e) => e.t);
    expect(kinds).toContain("msg"); expect(kinds).toContain("upd"); expect(kinds).toContain("typing");
    const msg = got.find((e) => e.t === "msg" && e.id === m.id);
    expect(msg).toMatchObject({ room: g1Room, id: m.id, sender: A });
    expect(JSON.stringify(got)).not.toMatch(/secret/);                       // no body in any notification
  });

  it("query layer supports the comparison filters used for cursors", async () => {
    const { data } = await db.clientFor(A).from("chat_messages").select("seq").eq("room_id", g1Room).gt("seq", 0).lte("seq", 1_000_000).lt("seq", 999_999_999).order("seq", { ascending: true }).limit(3);
    expect(data.length).toBe(3);
  });
});
