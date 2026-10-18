/** Small browser-side helpers for chat. */
export function uuid(): string {
  // crypto.randomUUID only exists in secure contexts (https / localhost); fall back so plain-http LAN testing still works.
  const c = globalThis.crypto as Crypto;
  if (typeof c.randomUUID === "function") return c.randomUUID();
  const b = c.getRandomValues(new Uint8Array(16)); b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

const NPT = "Asia/Kathmandu";
export const clock = (iso: string) => new Intl.DateTimeFormat("en-GB", { timeZone: NPT, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
const dayKey = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: NPT }).format(new Date(iso));
export const sameDay = (a: string, b: string) => dayKey(a) === dayKey(b);
export function dayLabel(iso: string, now = new Date()) {
  const k = dayKey(iso);
  if (k === dayKey(now.toISOString())) return "Today";
  if (k === dayKey(new Date(now.getTime() - 86_400_000).toISOString())) return "Yesterday";
  return new Intl.DateTimeFormat("en-GB", { timeZone: NPT, weekday: "short", day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));
}
/** Compact time for the inbox: clock today, "Yesterday", else a short date. */
export function inboxTime(iso: string | null, now = new Date()) {
  if (!iso) return "";
  const k = dayKey(iso);
  if (k === dayKey(now.toISOString())) return clock(iso);
  if (k === dayKey(new Date(now.getTime() - 86_400_000).toISOString())) return "Yesterday";
  return new Intl.DateTimeFormat("en-GB", { timeZone: NPT, day: "numeric", month: "short" }).format(new Date(iso));
}

/** Deterministic colour for a sender's name in group chats. */
const NAME_TONES = ["text-indigo-700", "text-sky-700", "text-emerald-700", "text-amber-700", "text-rose-700", "text-violet-700", "text-teal-700", "text-orange-700"];
export function nameTone(id: string) { let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0; return NAME_TONES[h % NAME_TONES.length]; }
