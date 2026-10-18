"use client";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Download, FilePlus2, Heading, List, ListOrdered, Pilcrow, Save, Trash2 } from "lucide-react";
import { buildPdf, type Block, type PdfDoc } from "@/lib/pdf-builder";

type Q = { id: string; text: string; subject: string };
type Sem = { id: string; label: string };
const LABEL = { heading: "Heading", paragraph: "Paragraph", bullets: "Bullet list", questions: "Numbered questions" } as const;

async function fontBytes(url: string) { const r = await fetch(url); return r.ok ? new Uint8Array(await r.arrayBuffer()) : undefined; }

export function PdfMaker({ saved, semesters, defaultSemester, prefill }: { saved: Q[]; semesters: Sem[]; defaultSemester?: string; prefill: boolean }) {
  const [title, setTitle] = useState(""); const [subject, setSubject] = useState(""); const [semLabel, setSemLabel] = useState("");
  const [cover, setCover] = useState(true);
  const [blocks, setBlocks] = useState<Block[]>(prefill && saved.length ? [{ type: "heading", text: "Important questions" }, { type: "questions", items: saved.map((q) => q.text) }] : [{ type: "heading", text: "" }]);
  const [busy, setBusy] = useState(false);
  const [saveSem, setSaveSem] = useState(defaultSemester ?? semesters[0]?.id ?? "");

  const set = (i: number, b: Block) => setBlocks(blocks.map((x, j) => (j === i ? b : x)));
  const add = (t: Block["type"]) => setBlocks([...blocks, t === "heading" || t === "paragraph" ? { type: t, text: "" } : { type: t, items: [""] }]);
  const move = (i: number, d: number) => { const j = i + d; if (j < 0 || j >= blocks.length) return; const c = [...blocks]; [c[i], c[j]] = [c[j], c[i]]; setBlocks(c); };
  const doc = (): PdfDoc => ({ title, subject, semesterLabel: semLabel, cover, blocks: blocks.filter((b) => ("text" in b ? b.text.trim() : b.items.some((s) => s.trim()))) });

  async function make() {
    const d = doc();
    if (!title.trim()) { toast.error("Add a document title."); return null; }
    if (!d.blocks.length) { toast.error("Add some content first."); return null; }
    const [r, b] = await Promise.all([fontBytes("/fonts/noto-sans-devanagari-devanagari-400-normal.woff"), fontBytes("/fonts/noto-sans-devanagari-devanagari-700-normal.woff")]);
    return buildPdf(d, { devanagariRegular: r, devanagariBold: b });
  }
  async function download() {
    setBusy(true);
    try { const bytes = await make(); if (!bytes) return; const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
      const a = document.createElement("a"); a.href = url; a.download = `${title.replace(/[^\w\- ]+/g, "").trim() || "document"}.pdf`; a.click(); URL.revokeObjectURL(url); toast.success("PDF downloaded."); }
    catch { toast.error("Could not create the PDF."); } finally { setBusy(false); }
  }
  async function saveToSemester() {
    if (!saveSem) return toast.error("Join or create a group first.");
    setBusy(true);
    try {
      const bytes = await make(); if (!bytes) return;
      const fd = new FormData();
      fd.set("file", new File([bytes as BlobPart], "document.pdf", { type: "application/pdf" })); fd.set("groupId", saveSem); fd.set("title", title.trim()); fd.set("category", "revision_notes"); fd.set("description", "Created with EduSathi PDF Maker");
      const r = await fetch("/api/documents", { method: "POST", body: fd }); const j = await r.json();
      (r.ok ? toast.success : toast.error)(r.ok ? "Saved as a private PDF in your group. You can publish it from Shared PDFs." : j.message);
    } catch { toast.error("Network error."); } finally { setBusy(false); }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <section className="card grid gap-3 p-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><label htmlFor="t" className="label">Document title</label><input id="t" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} className="input" /></div>
          <div><label htmlFor="s" className="label">Subject</label><input id="s" value={subject} onChange={(e) => setSubject(e.target.value)} className="input" /></div>
          <div><label htmlFor="sl" className="label">Semester label</label><input id="sl" value={semLabel} onChange={(e) => setSemLabel(e.target.value)} placeholder="BIT · Semester 3" className="input" /></div>
          <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={cover} onChange={(e) => setCover(e.target.checked)} />Include cover page</label>
        </section>
        {blocks.map((b, i) => (
          <section key={i} className="card p-4" aria-label={`${LABEL[b.type]} ${i + 1}`}>
            <div className="mb-2 flex items-center justify-between"><span className="badge">{LABEL[b.type]}</span>
              <span className="flex gap-1"><button className="btn-ghost !min-h-[32px] !px-2" aria-label="Move up" onClick={() => move(i, -1)}><ArrowUp className="h-4 w-4" /></button>
                <button className="btn-ghost !min-h-[32px] !px-2" aria-label="Move down" onClick={() => move(i, 1)}><ArrowDown className="h-4 w-4" /></button>
                <button className="btn-ghost !min-h-[32px] !px-2" aria-label="Remove block" onClick={() => setBlocks(blocks.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></button></span></div>
            {"text" in b ? <textarea value={b.text} onChange={(e) => set(i, { ...b, text: e.target.value })} rows={b.type === "heading" ? 1 : 4} className="input" aria-label={LABEL[b.type]} />
              : <textarea value={b.items.join("\n")} onChange={(e) => set(i, { ...b, items: e.target.value.split("\n") })} rows={5} className="input" aria-label={LABEL[b.type]} placeholder="One item per line" />}
          </section>))}
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary" onClick={() => add("heading")}><Heading className="h-4 w-4" aria-hidden />Heading</button>
          <button className="btn-secondary" onClick={() => add("paragraph")}><Pilcrow className="h-4 w-4" aria-hidden />Paragraph</button>
          <button className="btn-secondary" onClick={() => add("bullets")}><List className="h-4 w-4" aria-hidden />Bullets</button>
          <button className="btn-secondary" onClick={() => add("questions")}><ListOrdered className="h-4 w-4" aria-hidden />Questions</button>
          {saved.length > 0 && <button className="btn-secondary" onClick={() => { setBlocks([...blocks, { type: "questions", items: saved.map((q) => q.text) }]); toast.success("Imported your saved questions."); }}><FilePlus2 className="h-4 w-4" aria-hidden />Import saved questions</button>}
        </div>
      </div>

      <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        <section className="card p-5" aria-label="Preview">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Preview</p>
          <div className="min-h-[300px] space-y-3 rounded-control border border-line bg-white p-6 text-sm">
            {cover && <div className="border-b border-line pb-6"><div className="mb-3 h-1 w-12 bg-brand-600" /><p className="text-2xl font-extrabold">{title || "Untitled"}</p><p className="mt-2 text-brand-600">{subject}</p><p className="text-muted">{semLabel}</p></div>}
            {!cover && <div><p className="text-xl font-bold">{title || "Untitled"}</p><p className="text-xs text-muted">{[subject, semLabel].filter(Boolean).join(" · ")}</p></div>}
            {blocks.map((b, i) => b.type === "heading" ? <h3 key={i} className="text-base font-bold text-brand-600">{b.text}</h3>
              : b.type === "paragraph" ? <p key={i} className="whitespace-pre-line">{b.text}</p>
              : b.type === "bullets" ? <ul key={i} className="list-disc pl-6">{b.items.filter(Boolean).map((t, j) => <li key={j}>{t}</li>)}</ul>
              : <ol key={i} className="list-decimal pl-6">{b.items.filter(Boolean).map((t, j) => <li key={j}>{t}</li>)}</ol>)}
          </div>
        </section>
        <div className="card space-y-3 p-4">
          <button className="btn-primary w-full" onClick={download} disabled={busy}><Download className="h-4 w-4" aria-hidden />{busy ? "Working…" : "Download PDF"}</button>
          {semesters.length > 0 && (<div className="flex gap-2">
            <label htmlFor="ss" className="sr-only">Save to group</label>
            <select id="ss" value={saveSem} onChange={(e) => setSaveSem(e.target.value)} className="input">{semesters.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select>
            <button className="btn-secondary shrink-0" onClick={saveToSemester} disabled={busy}><Save className="h-4 w-4" aria-hidden />Save privately</button></div>)}
          <p className="text-xs text-muted">Only use content you wrote or have permission to share. Don&apos;t paste commercial textbook material.</p>
        </div>
      </div>
    </div>
  );
}
