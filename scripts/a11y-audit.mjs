// WCAG 2.1 A/AA audit of the main screens with axe-core, at desktop and phone width.
// Needs a running app + a test account:
//   BASE_URL=http://localhost:3000 EMAIL=you@example.com PASSWORD=... GROUP_ID=<uuid> CHROME=/path/to/chrome node scripts/a11y-audit.mjs
import { chromium } from "playwright-core";
import { readFileSync } from "fs";
import { createRequire } from "module";

const { BASE_URL = "http://localhost:3000", EMAIL, PASSWORD, GROUP_ID, CHROME } = process.env;
if (!EMAIL || !PASSWORD) { console.error("Set EMAIL and PASSWORD for a test account."); process.exit(2); }
const axeSrc = readFileSync(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8");
const pages = ["/", "/find-groups", "/login", "/signup", "/colleges", "/public-notes", "/dashboard", "/my-groups", "/groups/new", "/pdf-maker", "/profile", "/notifications", "/settings",
  ...(GROUP_ID ? ["", "/files", "/discussions", "/questions", "/members", "/settings"].map((s) => `/groups/${GROUP_ID}${s}`) : [])];

const browser = await chromium.launch({ executablePath: CHROME, args: ["--no-sandbox"] });
let failures = 0;
for (const [label, width, height] of [["desktop", 1280, 900], ["phone", 390, 844]]) {
  const page = await (await browser.newContext({ viewport: { width, height } })).newPage();
  await page.goto(`${BASE_URL}/login`); await page.fill("[name=email]", EMAIL); await page.fill("[name=password]", PASSWORD);
  await page.click('button:has-text("Log In")'); await page.waitForTimeout(1500);
  for (const path of pages) {
    await page.goto(BASE_URL + path, { waitUntil: "networkidle" }).catch(() => {});
    await page.addScriptTag({ content: axeSrc });
    const r = await page.evaluate(() => window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } }));
    for (const v of r.violations) { failures++; console.log(`[${label}] ${path}  ${v.impact}  ${v.id}: ${v.help} (${v.nodes.length}) e.g. ${v.nodes[0].target.join(" ")}`); }
  }
}
await browser.close();
console.log(failures ? `${failures} violation group(s) found` : `No WCAG 2.1 A/AA violations on ${pages.length} pages x 2 viewports`);
process.exit(failures ? 1 : 0);
