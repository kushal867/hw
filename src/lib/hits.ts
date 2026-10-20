import "server-only";
import { createHash } from "crypto";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/db";
import { allow } from "@/lib/security";

const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|headless|lighthouse|monitor|curl|wget/i;
const keyId = (s: string) => { const h = createHash("md5").update(s).digest("hex"); return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`; };

/**
 * Count a view/download of a PUBLIC note. A visitor (by IP) counts at most once per hour per note and kind, bots are ignored,
 * and the database function only touches published notes, so the numbers cannot be inflated by repeated requests.
 */
export async function recordNoteHit(docId: string, kind: "view" | "download") {
  try {
    const h = await headers();
    if (BOT.test(h.get("user-agent") ?? "")) return;
    const ip = h.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
    if (!(await allow(keyId(`note:${kind}:${docId}:${ip}`), `note.${kind}`, 1, 3600))) return;
    await createAdminClient().rpc("record_note_hit", { p_doc: docId, p_kind: kind });
  } catch { /* statistics must never break a page */ }
}
