"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { CATEGORIES } from "@/lib/format";

export function UploadForm({ semesterId, subjects, maxMb }: { semesterId: string; subjects: { id: string; name: string }[]; maxMb: number }) {
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLFormElement>(null);
  const router = useRouter();
  return (
    <form ref={ref} className="card grid gap-3 p-5 sm:grid-cols-2" aria-busy={busy} onSubmit={async (e) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      const f = fd.get("file") as File;
      if (!f?.size) return toast.error("Choose a PDF to upload.");
      if (f.size > maxMb * 1024 * 1024) return toast.error(`Files must be ${maxMb} MB or smaller.`);
      setBusy(true);
      try {
        const res = await fetch("/api/documents", { method: "POST", body: fd });
        const j = await res.json().catch(() => ({ message: "Upload failed." }));
        if (res.ok) { toast.success("Uploaded. It's private to your semester."); ref.current?.reset(); router.refresh(); } else toast.error(j.message);
      } catch { toast.error("Network error. Please try again."); } finally { setBusy(false); }
    }}>
      <input type="hidden" name="semesterId" value={semesterId} />
      <div className="sm:col-span-2"><label htmlFor="file" className="label">PDF file (max {maxMb} MB)</label><input id="file" name="file" type="file" accept="application/pdf,.pdf" required className="input" disabled={busy} /></div>
      <div><label htmlFor="title" className="label">Title</label><input id="title" name="title" required minLength={3} maxLength={140} className="input" disabled={busy} /></div>
      <div><label htmlFor="category" className="label">Category</label><select id="category" name="category" required className="input" disabled={busy}>{Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
      <div><label htmlFor="subjectId" className="label">Subject</label><select id="subjectId" name="subjectId" className="input" disabled={busy}><option value="">No specific subject</option>{subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
      <div><label htmlFor="tags" className="label">Tags</label><input id="tags" name="tags" placeholder="unit 3, sorting" className="input" disabled={busy} /></div>
      <div className="sm:col-span-2"><label htmlFor="description" className="label">Description (optional)</label><textarea id="description" name="description" rows={2} maxLength={1000} className="input" disabled={busy} /></div>
      <div className="sm:col-span-2"><button className="btn-primary" disabled={busy}><Upload className="h-4 w-4" aria-hidden />{busy ? "Uploading…" : "Upload privately"}</button></div>
    </form>
  );
}
