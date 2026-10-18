import { MAX_MESSAGE_LENGTH } from "@/lib/chat/types";

// Characters that let a sender spoof or hide text: bidi overrides/isolates, zero-width space/no-break, word joiner, LRM/RLM.
// U+200C / U+200D (ZWNJ/ZWJ) are deliberately KEPT: Nepali/Hindi conjuncts need them.
const SPOOFING = /[​‎‏‪-‮⁠-⁤⁦-⁩﻿]/g;
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g;

export type Sanitized = { ok: true; text: string } | { ok: false; reason: "empty" | "too_long" };

/** Normalises a chat message. Length is counted in code points, exactly like the database's char_length check. */
export function sanitizeBody(raw: string): Sanitized {
  const text = raw.normalize("NFC").replace(/\r\n?/g, "\n").replace(CONTROL, "").replace(SPOOFING, "")
    .replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!text) return { ok: false, reason: "empty" };
  if ([...text].length > MAX_MESSAGE_LENGTH) return { ok: false, reason: "too_long" };
  return { ok: true, text };
}

/** One-line preview for lists and reply quotes. */
export function preview(text: string | null, max = 90) {
  if (!text) return "";
  const one = text.replace(/\s+/g, " ").trim();
  const chars = [...one];
  return chars.length > max ? chars.slice(0, max - 1).join("") + "…" : one;
}
