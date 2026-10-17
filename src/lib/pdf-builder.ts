import "regenerator-runtime/runtime"; // @pdf-lib/fontkit's Indic (Devanagari) shaper needs this global
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

export type Block =
  | { type: "heading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "bullets"; items: string[] }
  | { type: "questions"; items: string[] };

export type PdfDoc = { title: string; subject: string; semesterLabel: string; cover: boolean; blocks: Block[] };
export type Fonts = { devanagariRegular?: Uint8Array; devanagariBold?: Uint8Array };

const A4: [number, number] = [595.28, 841.89];
const M = 56;                       // margins
const DEV = /[ऀ-ॿ]/;
const INK = rgb(0.06, 0.09, 0.16);
const BRAND = rgb(0.31, 0.27, 0.9);

/** Splits a word into runs so Devanagari uses the embedded font and Latin uses Helvetica. */
function runs(word: string) {
  const out: { t: string; dev: boolean }[] = [];
  for (const ch of word) {
    const dev = DEV.test(ch) || ch === "‌" || ch === "‍";
    if (out.length && out[out.length - 1].dev === dev) out[out.length - 1].t += ch; else out.push({ t: ch, dev });
  }
  return out;
}

export async function buildPdf(doc: PdfDoc, fonts: Fonts = {}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  pdf.setTitle(doc.title); pdf.setCreator("EduSathi"); pdf.setProducer("EduSathi");
  const latin = await pdf.embedFont(StandardFonts.Helvetica);
  const latinBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const dev = fonts.devanagariRegular ? await pdf.embedFont(fonts.devanagariRegular, { subset: true }) : null;
  const devBold = fonts.devanagariBold ? await pdf.embedFont(fonts.devanagariBold, { subset: true }) : dev;

  const safeLatin = (f: PDFFont, s: string) => { // Helvetica only encodes WinAnsi; replace anything else rather than crash
    let r = "";
    for (const c of s) { try { f.encodeText(c); r += c; } catch { r += "?"; } }
    return r;
  };
  const pick = (r: { t: string; dev: boolean }, bold: boolean) => (r.dev && dev ? (bold ? devBold! : dev) : bold ? latinBold : latin);
  const textOf = (r: { t: string; dev: boolean }, f: PDFFont) => (f === latin || f === latinBold ? safeLatin(f, r.dev ? "?".repeat([...r.t].length) : r.t) : r.t);
  const width = (w: string, size: number, bold: boolean) => runs(w).reduce((a, r) => { const f = pick(r, bold); return a + f.widthOfTextAtSize(textOf(r, f), size); }, 0);

  const pageW = A4[0] - M * 2;
  let page: PDFPage = pdf.addPage(A4);
  let y = A4[1] - M;
  const newPage = () => { page = pdf.addPage(A4); y = A4[1] - M; };

  /** Draws wrapped text; handles page breaks line by line. Returns nothing; advances y. */
  function para(text: string, size: number, opts: { bold?: boolean; indent?: number; color?: ReturnType<typeof rgb>; gap?: number; bullet?: string } = {}) {
    const { bold = false, indent = 0, color = INK, gap = 6, bullet } = opts;
    const lh = size * 1.5, maxW = pageW - indent;
    for (const rawLine of text.split("\n")) {
      const words = rawLine.split(/\s+/).filter(Boolean);
      const lines: string[] = []; let cur = "";
      for (const w of words) {
        const trial = cur ? `${cur} ${w}` : w;
        if (width(trial, size, bold) <= maxW || !cur) cur = trial; else { lines.push(cur); cur = w; }
      }
      lines.push(cur);
      lines.forEach((ln, i) => {
        if (y - lh < M + 20) newPage();
        y -= lh;
        if (bullet && i === 0) page.drawText(safeLatin(latin, bullet), { x: M + indent - 16, y, size, font: latin, color });
        let x = M + indent;
        for (const w of ln.split(" ")) {
          for (const r of runs(w)) { const f = pick(r, bold); const t = textOf(r, f); if (t) { page.drawText(t, { x, y, size, font: f, color }); x += f.widthOfTextAtSize(t, size); } }
          x += latin.widthOfTextAtSize(" ", size);
        }
      });
    }
    y -= gap;
  }

  if (doc.cover) {
    y = A4[1] - 240;
    page.drawRectangle({ x: M, y: y + 20, width: 60, height: 5, color: BRAND });
    para(doc.title || "Untitled", 30, { bold: true, gap: 14 });
    if (doc.subject) para(doc.subject, 16, { color: BRAND });
    if (doc.semesterLabel) para(doc.semesterLabel, 13, { color: rgb(0.39, 0.45, 0.55) });
    newPage();
  } else {
    para(doc.title || "Untitled", 22, { bold: true, gap: 4 });
    const sub = [doc.subject, doc.semesterLabel].filter(Boolean).join(" · ");
    if (sub) para(sub, 11, { color: rgb(0.39, 0.45, 0.55), gap: 14 });
  }

  for (const b of doc.blocks) {
    if (b.type === "heading") { y -= 8; para(b.text, 16, { bold: true, color: BRAND, gap: 8 }); }
    else if (b.type === "paragraph") para(b.text, 11.5, { gap: 10 });
    else b.items.filter((s) => s.trim()).forEach((it, i) => para(it, 11.5, { indent: 22, gap: 6, bullet: b.type === "bullets" ? "•" : `${i + 1}.` }));
  }

  const pages = pdf.getPages();
  pages.forEach((p, i) => {
    if (doc.cover && i === 0) return;
    const label = `${i + 1} / ${pages.length}`;
    p.drawText(label, { x: A4[0] / 2 - latin.widthOfTextAtSize(label, 9) / 2, y: 28, size: 9, font: latin, color: rgb(0.5, 0.55, 0.62) });
    p.drawText("EduSathi", { x: M, y: 28, size: 9, font: latinBold, color: rgb(0.5, 0.55, 0.62) });
  });
  return pdf.save();
}
