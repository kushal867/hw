"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileText, Upload, X } from "lucide-react";
import { CATEGORIES, formatBytes } from "@/lib/format";

export function UploadForm({ groupId, subjects, maxMb }: { groupId: string; subjects: { id: string; name: string }[]; maxMb: number }) {
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [drag, setDrag] = useState(false);
  const ref = useRef<HTMLFormElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();

  function pick(f: File | null | undefined) {
    if (!f) return;
    if (f.size > maxMb * 1024 * 1024) { toast.error(`That file is ${formatBytes(f.size)}. The limit is ${maxMb} MB.`); return; }
    if (f.type && f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) { toast.error("Please choose a PDF file."); return; }
    setFile(f);
    const t = ref.current?.elements.namedItem("title") as HTMLInputElement | null;
    if (t && !t.value) t.value = f.name.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ").slice(0, 140);
  }

  return (
    <form ref={ref} className="grid gap-4 sm:grid-cols-2" aria-busy={busy} onSubmit={async (e) => {
      e.preventDefault();
      if (!file) return toast.error("Choose a PDF to upload.");
      const fd = new FormData(e.currentTarget); fd.set("file", file);
      setBusy(true);
      try {
        const res = await fetch("/api/documents", { method: "POST", body: fd });
        const j = await res.json().catch(() => ({ message: "Upload failed." }));
        if (res.ok) { toast.success("Uploaded. It's private to your group."); ref.current?.reset(); setFile(null); router.refresh(); } else toast.error(j.message);
      } catch { toast.error("Network error. Please try again."); } finally { setBusy(false); }
    }}>
      <input type="hidden" name="groupId" value={groupId} />
      <div className="sm:col-span-2">
        <input ref={input} id="file" type="file" accept="application/pdf,.pdf" className="sr-only" disabled={busy} onChange={(e) => pick(e.target.files?.[0])} />
        {!file ? (
          <label htmlFor="file" onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files?.[0]); }}
            className={`flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-4 py-8 text-center transition ${drag ? "border-brand-500 bg-brand-50" : "border-slate-300 bg-slate-50 hover:border-brand-300 hover:bg-brand-50/50"}`}>
            <span className="grid h-12 w-12 place-items-center rounded-xl bg-white text-brand-600 shadow-sm"><Upload className="h-6 w-6" aria-hidden /></span>
            <span className="text-sm font-semibold">Drop a PDF here, or <span className="text-brand-700 underline">browse</span></span>
            <span className="text-xs text-muted">PDF only · up to {maxMb} MB · private to this group until you publish it</span>
          </label>
        ) : (
          <div className="flex items-center gap-3 rounded-2xl border border-line bg-slate-50 p-3.5">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-rose-50 text-rose-600"><FileText className="h-5 w-5" aria-hidden /></span>
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{file.name}</p><p className="text-xs text-muted">{formatBytes(file.size)}</p></div>
            <button type="button" className="btn-ghost !px-2" onClick={() => { setFile(null); if (input.current) input.current.value = ""; }} aria-label="Remove file" disabled={busy}><X className="h-4 w-4" /></button>
          </div>)}
      </div>
      <div><label htmlFor="title" className="label">Title</label><input id="title" name="title" required minLength={3} maxLength={140} className="input" disabled={busy} placeholder="e.g. Data Structures – Unit 2 notes" /></div>
      <div><label htmlFor="category" className="label">Category</label><select id="category" name="category" required className="input" disabled={busy}>{Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
      {subjects.length > 0 && <div><label htmlFor="subjectId" className="label">Subject</label><select id="subjectId" name="subjectId" className="input" disabled={busy}><option value="">No specific subject</option>{subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>}
      <div><label htmlFor="tags" className="label">Tags <span className="font-normal text-muted">(optional)</span></label><input id="tags" name="tags" placeholder="unit 3, sorting" className="input" disabled={busy} /></div>
      <div className="sm:col-span-2"><label htmlFor="description" className="label">Description <span className="font-normal text-muted">(optional)</span></label><textarea id="description" name="description" rows={2} maxLength={1000} className="input" disabled={busy} /></div>
      <div className="sm:col-span-2"><button className="btn-primary btn-lg w-full sm:w-auto" disabled={busy || !file}><Upload className="h-4 w-4" aria-hidden />{busy ? "Uploading…" : "Upload privately"}</button></div>
    </form>
  );
}
