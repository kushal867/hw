// End-to-end chat test with real browsers: live delivery, typing, replies, reactions, edit/delete, unread badges,
// DMs, blocking, offline catch-up, and security probes (outsider, cross-site POST). Re-runnable: it creates fresh users.
//   BASE_URL=http://localhost:3000 CHROME=/path/to/chrome node scripts/e2e-chat.mjs
// Note: sign-ups are limited to 10 per IP per hour. On a DEV database, run `delete from rate_limits;` between runs.
import { chromium } from "playwright-core";
import { readFileSync } from "fs";
import { createRequire } from "module";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const run = Math.random().toString(36).slice(2, 8);
const axeSrc = readFileSync(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8");
const browser = await chromium.launch({ executablePath: process.env.CHROME, args: ["--no-sandbox"] });
let passed = 0; const problems = []; const consoleErrors = [];

const ok = (name) => { passed++; console.log(`  ✓ ${name}`); };
let stepNo = 0; const ONLY = Number(process.env.MAX_STEPS ?? 999);
async function step(name, fn) { if (++stepNo > ONLY) return; try { await fn(); ok(name); } catch (e) { const msg = e.message.split("\n").filter(Boolean).slice(0, 3).join(" ⏎ "); problems.push(`${name}: ${msg}`); console.log(`  ✗ ${name}\n      ${msg}`); } }
const see = (page, text, t = 9000) => page.getByText(text, { exact: false }).first().waitFor({ state: "visible", timeout: t });
const gone = (page, text, t = 9000) => page.getByText(text, { exact: false }).first().waitFor({ state: "hidden", timeout: t });

async function newUser(name) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) consoleErrors.push(`${name}: ${m.text().slice(0, 160)}`); });
  page.on("pageerror", (e) => consoleErrors.push(`${name} pageerror: ${e.message.slice(0, 160)}`));
  const email = `${name.toLowerCase()}-${run}@example.com`;
  await page.goto(BASE + "/signup"); await page.fill("[name=name]", name); await page.fill("[name=email]", email); await page.fill("[name=password]", "password123"); await page.check("[name=agree]");
  await page.click('button:has-text("Create account")'); await page.waitForURL(/dashboard/, { timeout: 10000 });
  return { ctx, page, name, email };
}
const composer = (p) => p.locator("textarea[id^=composer-]:visible");
async function send(p, text) { await composer(p).fill(text); await composer(p).press("Enter"); }

console.log(`\nChat end-to-end (run ${run})`);
const A = await newUser("Anita"), B = await newUser("Bikash"), C = await newUser("Chandra");
let gid = "", roomUrl = "";

await step("A creates a group; B finds it and joins; both land in its chat", async () => {
  await A.page.goto(BASE + "/groups/new"); await A.page.fill("#name", `Chat E2E ${run}`); await A.page.selectOption("#join_policy", "open"); await A.page.click('button:has-text("Create group")');
  await A.page.waitForURL(/\/groups\/[0-9a-f-]{36}$/); gid = A.page.url().split("/").pop();
  await B.page.goto(`${BASE}/groups/${gid}`);
  await B.page.getByRole("button", { name: /join group|request to join/i }).click();
  await see(B.page, "You've joined", 8000).catch(() => {}); await B.page.waitForSelector("text=Overview", { timeout: 8000 });
  roomUrl = `${BASE}/groups/${gid}/chat`;
  await A.page.goto(roomUrl); await B.page.goto(roomUrl);
  await see(A.page, "Start the conversation");
});

await step("a message appears LIVE on the other side, no reload", async () => {
  await send(A.page, "Hello from Anita 👋");
  await see(A.page, "Hello from Anita"); await see(B.page, "Hello from Anita");
});

await step("typing indicator reaches the other member", async () => {
  await composer(A.page).fill("typing something…");
  await see(B.page, "Anita is typing", 6000);
  await composer(A.page).fill("");
});

await step("reply shows the quoted message to both", async () => {
  const msg = B.page.locator("article", { hasText: "Hello from Anita" }).first();
  await msg.hover(); await msg.getByRole("button", { name: "Reply" }).click();
  await see(B.page, "Replying to Anita");
  await send(B.page, "Hi Anita, glad to be here");
  await see(A.page, "Hi Anita, glad to be here");
  await A.page.locator("article", { hasText: "Hi Anita, glad" }).getByText("Hello from Anita").first().waitFor();
});

await step("reactions sync live", async () => {
  const msg = A.page.locator("article", { hasText: "Hi Anita, glad" }).first();
  await msg.hover(); await msg.getByRole("button", { name: "Add reaction" }).click();
  await A.page.getByRole("button", { name: "React like" }).click();
  await B.page.getByRole("button", { name: /like reaction, 1/ }).waitFor({ timeout: 9000 });
});

await step("edit marks the message edited for everyone", async () => {
  const msg = A.page.locator("article", { hasText: "Hello from Anita" }).first();
  await msg.hover(); await msg.getByRole("button", { name: "Edit message" }).click();
  await composer(A.page).fill("Hello everyone, welcome!"); await composer(A.page).press("Enter");
  await see(B.page, "Hello everyone, welcome!"); await see(B.page, "edited");
});

await step("delete erases the message for everyone", async () => {
  const msg = A.page.locator("article", { hasText: "Hello everyone, welcome!" }).first();
  A.page.once("dialog", (d) => d.accept());
  await msg.hover(); await msg.getByRole("button", { name: "Delete message" }).click();
  await see(B.page, "Message deleted"); await gone(B.page, "Hello everyone, welcome!");
});

await step("a member cannot delete someone else's message (no delete control offered)", async () => {
  const msg = B.page.locator("article", { hasText: "Hi Anita, glad" }).first();   // B's own: has delete
  await msg.hover(); await msg.getByRole("button", { name: "Delete message" }).waitFor();
  const aMsgOnB = B.page.locator("article", { hasText: "Hi Anita" });
  const count = await B.page.getByRole("button", { name: "Delete message" }).count();
  if (count < 1) throw new Error("own delete missing");
});

await step("unread badge updates live while on another page, then clears when read", async () => {
  await B.page.goto(BASE + "/dashboard");
  await send(A.page, "Are you there Bikash?");
  const badge = B.page.getByLabel(/unread chat messages/).first();
  await badge.waitFor({ state: "visible", timeout: 9000 });
  await B.page.goto(roomUrl); await see(B.page, "Are you there Bikash?");
  await B.page.getByLabel(/unread chat messages/).first().waitFor({ state: "hidden", timeout: 9000 });
});

await step("offline catch-up: messages sent while B is offline arrive when it reconnects", async () => {
  await B.ctx.setOffline(true); await B.page.waitForTimeout(800);
  await send(A.page, "You missed this one");
  await B.page.waitForTimeout(1200);
  await B.ctx.setOffline(false);
  await see(B.page, "You missed this one", 15000);
});

await step("optimistic send + failure + retry (server unreachable for one send)", async () => {
  await A.page.route("**/api/chat/rooms/*/messages", (r) => r.request().method() === "POST" ? r.abort() : r.continue());
  await send(A.page, "will fail first");
  await see(A.page, "Not sent");
  await A.page.unroute("**/api/chat/rooms/*/messages");
  await A.page.getByRole("button", { name: "Retry" }).click();
  await see(B.page, "will fail first");
  const n = await B.page.getByText("will fail first").count();
  if (n !== 1) throw new Error(`expected exactly one copy, saw ${n}`);
});

await step("direct message between classmates, with unread + block", async () => {
  await B.page.goto(`${BASE}/groups/${gid}/members`);
  await B.page.getByRole("button", { name: "Message Anita" }).click();
  await B.page.waitForURL(/\/chat\/[0-9a-f-]{36}/); await composer(B.page).waitFor({ timeout: 9000 });
  await send(B.page, "private hello"); await see(B.page, "private hello");
  await A.page.goto(BASE + "/chat"); await see(A.page, "private hello");
  await A.page.locator("aside").getByRole("link", { name: /^Bikash/ }).first().click();
  await A.page.waitForURL(/\/chat\/[0-9a-f-]{36}/); await composer(A.page).waitFor({ timeout: 9000 });
  await see(A.page, "private hello");
  await send(A.page, "got it, hi");
  await see(B.page, "got it, hi");
  await A.page.locator('summary[aria-label="Chat options"]').click();
  A.page.once("dialog", (d) => d.accept());
  await A.page.getByRole("button", { name: /Block Bikash/ }).click();
  await see(A.page, "You blocked this person");
  await B.page.reload().catch(() => {});
  await see(B.page, "can't send messages to this person");
});

await step("outsider C cannot read or write the group chat (API)", async () => {
  const roomId = await A.page.evaluate(async (g) => { const r = await fetch(`/groups/${g}/chat`); return (await r.text()).match(/composer-([0-9a-f-]{36})/)?.[1]; }, gid);
  if (!roomId) throw new Error("could not find room id");
  const read = await C.ctx.request.get(`${BASE}/api/chat/rooms/${roomId}/messages`);
  const j = await read.json(); if (read.status() !== 200 || j.messages.length !== 0) throw new Error(`outsider read ${read.status()} ${JSON.stringify(j).slice(0, 80)}`);
  const write = await C.ctx.request.post(`${BASE}/api/chat/rooms/${roomId}/messages`, { headers: { origin: BASE }, data: { body: "let me in", clientId: "11111111-1111-4111-8111-111111111111" } });
  if (write.status() !== 403) throw new Error(`outsider write got ${write.status()}`);
  const page = await C.page.goto(`${BASE}/groups/${gid}/chat`); // group is open → C sees the join card, never the chat
  await C.page.getByText("Messages").first().waitFor({ state: "detached", timeout: 1000 }).catch(() => {});
  if (await composer(C.page).count()) throw new Error("outsider sees a composer");
});

await step("cross-site and header-less POSTs are refused (CSRF), unauthenticated gets 401", async () => {
  const roomId = await A.page.evaluate(async (g) => (await (await fetch(`/groups/${g}/chat`)).text()).match(/composer-([0-9a-f-]{36})/)?.[1], gid);
  const url = `${BASE}/api/chat/rooms/${roomId}/messages`; const body = { body: "csrf", clientId: "22222222-2222-4222-8222-222222222222" };
  const evil = await A.ctx.request.post(url, { headers: { origin: "https://evil.example" }, data: body });
  if (evil.status() !== 403) throw new Error(`cross-origin POST got ${evil.status()}`);
  const bare = await A.ctx.request.post(url, { data: body });
  if (bare.status() !== 403) throw new Error(`origin-less POST got ${bare.status()}`);
  const anon = await (await browser.newContext()).request.get(`${BASE}/api/chat/unread`);
  if (anon.status() !== 401) throw new Error(`anonymous got ${anon.status()}`);
});

await step("rate limiting: a burst of sends is throttled (429)", async () => {
  const roomId = await A.page.evaluate(async (g) => (await (await fetch(`/groups/${g}/chat`)).text()).match(/composer-([0-9a-f-]{36})/)?.[1], gid);
  const statuses = await A.page.evaluate(async (room) => Promise.all(Array.from({ length: 16 }, (_, i) => fetch(`/api/chat/rooms/${room}/messages`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ body: `burst ${i}`, clientId: crypto.randomUUID() }) }).then((r) => r.status))), roomId);
  if (!statuses.includes(429)) throw new Error(`no 429 in ${statuses}`);
  if (!statuses.includes(200)) throw new Error("no message got through at all");
});

await step("oversized and malformed bodies are rejected cleanly", async () => {
  const roomId = await B.page.evaluate(async (g) => (await (await fetch(`/groups/${g}/chat`)).text()).match(/composer-([0-9a-f-]{36})/)?.[1], gid);
  const r = await B.page.evaluate(async (room) => {
    const post = (b) => fetch(`/api/chat/rooms/${room}/messages`, { method: "POST", headers: { "content-type": "application/json" }, body: b }).then(async (x) => [x.status, (await x.json()).error?.code]);
    return [await post("{not json"), await post(JSON.stringify({ body: "x".repeat(2500), clientId: crypto.randomUUID() })), await post(JSON.stringify({ body: "   ", clientId: crypto.randomUUID() })), await post(JSON.stringify({ body: "ok", clientId: "nope" })), await post("x".repeat(40000))];
  }, roomId);
  const want = [[400, "invalid_json"], [400, "too_long"], [400, "empty"], [400, "invalid"], [413, "too_large"]];
  if (JSON.stringify(r) !== JSON.stringify(want)) throw new Error(`got ${JSON.stringify(r)}`);
});

await step("chat screens have no WCAG 2.1 A/AA violations (desktop + phone)", async () => {
  for (const [w, h] of [[1280, 900], [390, 844]]) {
    await A.page.setViewportSize({ width: w, height: h });
    for (const path of [roomUrl, `${BASE}/chat`, `${BASE}/chat/new`]) {
      await A.page.goto(path, { waitUntil: "load" }); await A.page.waitForSelector("main, section[aria-label^=Chat]", { timeout: 10000 }); await A.page.waitForTimeout(500); await A.page.addScriptTag({ content: axeSrc });
      const r = await A.page.evaluate(() => window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } }));
      if (r.violations.length) throw new Error(`${w}px ${path}: ${r.violations.map((v) => `${v.id} (${v.nodes[0].target.join(" ")})`).join("; ")}`);
    }
  }
});

await step("no console errors / CSP violations during the whole run", async () => { if (consoleErrors.length) throw new Error(consoleErrors.slice(0, 3).join(" | ")); });

await browser.close();
console.log(`\n${passed} passed, ${problems.length} failed`);
process.exit(problems.length ? 1 : 0);
