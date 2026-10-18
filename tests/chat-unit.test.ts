import { describe, expect, it } from "vitest";
import { sanitizeBody, preview } from "@/lib/chat/sanitize";
import { ApiError, isSameOrigin, ipFrom, keyId, mapDbError } from "@/lib/api-utils";

const headers = (o: Record<string, string>) => ({ get: (n: string) => o[n.toLowerCase()] ?? null });

describe("sanitizeBody", () => {
  it("trims, normalises line endings and collapses blank-line floods", () => {
    expect(sanitizeBody("  hi\r\nthere\n\n\n\n\nbye  ")).toEqual({ ok: true, text: "hi\nthere\n\nbye" });
  });
  it("rejects empty / whitespace-only / invisible-only messages", () => {
    for (const s of ["", "   \n\t ", "​​", "‮"]) expect(sanitizeBody(s)).toEqual({ ok: false, reason: "empty" });
  });
  it("removes bidi overrides and zero-width spoofing characters", () => {
    expect(sanitizeBody("pay‮ferp.exe​ now")).toEqual({ ok: true, text: "payferp.exe now" });
  });
  it("strips control characters but keeps newlines and tabs-as-space", () => {
    expect(sanitizeBody("a\u0000b\u0007c\nd")).toEqual({ ok: true, text: "abc\nd" });
  });
  it("KEEPS ZWJ/ZWNJ so Nepali conjuncts are not corrupted", () => {
    const nepali = "क्‍ष विद्यार्थी‌";
    const r = sanitizeBody(nepali); expect(r.ok && r.text.includes("‍")).toBe(true);
  });
  it("counts length in code points like the database does", () => {
    expect(sanitizeBody("😀".repeat(2000)).ok).toBe(true);        // 2000 code points (4000 UTF-16 units) is allowed
    expect(sanitizeBody("😀".repeat(2001))).toEqual({ ok: false, reason: "too_long" });
    expect(sanitizeBody("x".repeat(2001))).toEqual({ ok: false, reason: "too_long" });
  });
  it("normalises to NFC", () => { expect(sanitizeBody("é")).toEqual({ ok: true, text: "é" }); });
});

describe("preview", () => {
  it("flattens whitespace and truncates on code points", () => {
    expect(preview("a\n\n b")).toBe("a b");
    expect(preview("😀".repeat(100), 10)).toBe("😀".repeat(9) + "…");
    expect(preview(null)).toBe("");
  });
});

describe("isSameOrigin (CSRF defence)", () => {
  it("accepts a matching Origin", () => { expect(isSameOrigin(headers({ origin: "https://edusathi.tech", host: "edusathi.tech" }))).toBe(true); });
  it("honours the proxy host header", () => { expect(isSameOrigin(headers({ origin: "https://www.edusathi.tech", "x-forwarded-host": "www.edusathi.tech", host: "127.0.0.1:3000" }))).toBe(true); });
  it("rejects a foreign Origin", () => { expect(isSameOrigin(headers({ origin: "https://evil.example", host: "edusathi.tech" }))).toBe(false); });
  it("rejects a look-alike host", () => { expect(isSameOrigin(headers({ origin: "https://edusathi.tech.evil.example", host: "edusathi.tech" }))).toBe(false); });
  it("rejects malformed Origin values", () => { expect(isSameOrigin(headers({ origin: "null", host: "edusathi.tech" }))).toBe(false); });
  it("falls back to Sec-Fetch-Site only when Origin is absent", () => {
    expect(isSameOrigin(headers({ "sec-fetch-site": "same-origin", host: "x" }))).toBe(true);
    expect(isSameOrigin(headers({ "sec-fetch-site": "cross-site", host: "x" }))).toBe(false);
    expect(isSameOrigin(headers({ host: "x" }))).toBe(false);
  });
});

describe("mapDbError", () => {
  it("maps constraint and permission errors to safe statuses", () => {
    expect(mapDbError({ code: "23505" }).status).toBe(409);
    expect(mapDbError({ code: "23503" }).status).toBe(404);
    expect(mapDbError({ code: "PGRST116" }).status).toBe(404);
    expect(mapDbError({ code: "42501", message: "new row violates row-level security policy" })).toMatchObject({ status: 403, code: "forbidden" });
    expect(mapDbError({ code: "42501", message: "edit window has passed" })).toMatchObject({ status: 403, code: "edit_window" });
    expect(mapDbError({ code: "57014" }).status).toBe(503);
  });
  it("never leaks internals for unknown errors", () => {
    const e = mapDbError({ code: "XX000", message: 'relation "secret_table" does not exist' });
    expect(e).toBeInstanceOf(ApiError); expect(e.status).toBe(500); expect(e.message).not.toMatch(/secret_table/);
  });
});

describe("ipFrom / keyId", () => {
  it("takes the first forwarded address and bounds its length", () => {
    expect(ipFrom(headers({ "x-forwarded-for": "203.0.113.9, 10.0.0.1" }))).toBe("203.0.113.9");
    expect(ipFrom(headers({}))).toBe("unknown");
    expect(ipFrom(headers({ "x-forwarded-for": "x".repeat(500) })).length).toBe(64);
  });
  it("keyId is a deterministic uuid-shaped key", () => {
    expect(keyId("ip:1.2.3.4")).toBe(keyId("ip:1.2.3.4"));
    expect(keyId("ip:1.2.3.4")).not.toBe(keyId("ip:1.2.3.5"));
    expect(keyId("a")).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });
});
