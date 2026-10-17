import { describe, expect, it } from "vitest";
import { looksLikePdf, hashToken, newInviteToken } from "@/lib/security";
import { safeNext } from "@/lib/redirect";
import { slugify, formatBytes, formatDate, PUBLISHABLE } from "@/lib/format";

const pdf = (extra = "") => Buffer.from(`%PDF-1.4\n1 0 obj<<>>endobj\n${extra}\ntrailer<<>>\n%%EOF\n`);

describe("PDF content validation", () => {
  it("accepts a real PDF", () => expect(looksLikePdf(pdf())).toBe(true));
  it("rejects non-PDF bytes even if named .pdf", () => expect(looksLikePdf(Buffer.from("MZ\x90\x00 not a pdf at all"))).toBe(false));
  it("rejects truncated files with no EOF marker", () => expect(looksLikePdf(Buffer.from("%PDF-1.4\n1 0 obj"))).toBe(false));
  it("rejects PDFs with JavaScript or launch actions", () => {
    expect(looksLikePdf(pdf("/JS (app.alert(1))"))).toBe(false);
    expect(looksLikePdf(pdf("/Launch"))).toBe(false);
  });
  it("rejects tiny/empty input", () => expect(looksLikePdf(Buffer.alloc(0))).toBe(false));
});

describe("invite tokens", () => {
  it("are long, unique and URL-safe", () => {
    const a = newInviteToken(), b = newInviteToken();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[\w-]{43}$/);   // 256 bits, base64url
  });
  it("hash deterministically and never equal the token", () => {
    const t = newInviteToken();
    expect(hashToken(t)).toBe(hashToken(t));
    expect(hashToken(t)).not.toBe(t);
    expect(hashToken(t)).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("safeNext (open redirect protection)", () => {
  it.each(["/dashboard", "/join/abc123?x=1"])("allows %s", (p) => expect(safeNext(p)).toBe(p));
  it.each(["//evil.com", "https://evil.com", "javascript:alert(1)", "/\\evil.com", undefined, 42])("blocks %s", (p) => expect(safeNext(p)).toBe("/dashboard"));
});

describe("format helpers", () => {
  it("slugifies", () => expect(slugify("Tribhuvan Univ. — Kathmandu")).toBe("tribhuvan-univ-kathmandu"));
  it("formats bytes", () => { expect(formatBytes(2048)).toBe("2 KB"); expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB"); });
  it("renders dates in Nepal time (UTC+5:45)", () => expect(formatDate("2026-01-01T20:00:00Z", true)).toContain("01:45")); // next day in NPT
  it("never allows graded work to be published", () => { expect(PUBLISHABLE.has("homework")).toBe(false); expect(PUBLISHABLE.has("assignments")).toBe(false); expect(PUBLISHABLE.has("lab_reports")).toBe(false); });
});
