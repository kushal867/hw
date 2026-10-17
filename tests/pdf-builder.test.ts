import { readFileSync } from "fs";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { buildPdf, type PdfDoc } from "@/lib/pdf-builder";
import { looksLikePdf } from "@/lib/security";

const font = (w: number) => new Uint8Array(readFileSync(`public/fonts/noto-sans-devanagari-devanagari-${w}-normal.woff`));
const base: PdfDoc = { title: "Data Structures", subject: "CSIT 201", semesterLabel: "BIT · Semester 3", cover: true, blocks: [] };

describe("PDF export", () => {
  it("creates a valid PDF with a cover page and page numbers", async () => {
    const bytes = await buildPdf({ ...base, blocks: [{ type: "heading", text: "Unit 1" }, { type: "paragraph", text: "Arrays and linked lists." }] });
    expect(looksLikePdf(Buffer.from(bytes))).toBe(true);
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(2); // cover + content
  });
  it("paginates long content", async () => {
    const items = Array.from({ length: 120 }, (_, i) => `Question number ${i + 1}: explain the concept in detail with examples.`);
    const bytes = await buildPdf({ ...base, cover: false, blocks: [{ type: "questions", items }] });
    expect((await PDFDocument.load(bytes)).getPageCount()).toBeGreaterThan(2);
  });
  it("embeds a Devanagari font for Nepali text", async () => {
    const withFont = await buildPdf({ ...base, blocks: [{ type: "paragraph", text: "नमस्ते विद्यार्थी — Data Structures परीक्षा" }] }, { devanagariRegular: font(400), devanagariBold: font(700) });
    const without = await buildPdf({ ...base, blocks: [{ type: "paragraph", text: "नमस्ते विद्यार्थी" }] });
    expect(withFont.length).toBeGreaterThan(without.length + 3000);  // glyph subset embedded
    expect(without.length).toBeGreaterThan(0);                       // degrades gracefully instead of throwing
  });
  it("does not crash on unsupported characters", async () => {
    await expect(buildPdf({ ...base, blocks: [{ type: "paragraph", text: "emoji 😀 and ∑ symbols" }] })).resolves.toBeInstanceOf(Uint8Array);
  });
});
