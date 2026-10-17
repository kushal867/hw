"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

/** Admin control: set or remove a college's photo. */
export function CollegePhoto({ collegeId, logoPath, name }: { collegeId: string; logoPath: string | null; name: string }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const call = async (init: RequestInit, ok: string) => {
    setBusy(true);
    try {
      const r = await fetch(`/api/admin/colleges/${collegeId}/photo`, init); const j = await r.json().catch(() => ({ message: "Failed." }));
      (r.ok ? toast.success : toast.error)(r.ok ? ok : j.message); router.refresh();
    } catch { toast.error("Network error."); } finally { setBusy(false); }
  };
  return (
    <div className="flex items-center gap-3">
      {logoPath
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={`/media/colleges/${logoPath}`} alt="" width={56} height={56} className="h-14 w-14 rounded-control border border-line object-cover" />
        : <span aria-hidden className="grid h-14 w-14 place-items-center rounded-control border border-dashed border-line text-xs text-muted">No photo</span>}
      <div className="flex flex-wrap gap-2">
        <label htmlFor={`photo-${collegeId}`} className="btn-secondary cursor-pointer !min-h-[36px]">{busy ? "Working…" : logoPath ? "Change photo" : "Add photo"}</label>
        <input id={`photo-${collegeId}`} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" disabled={busy} aria-label={`Photo for ${name}`}
          onChange={(e) => {
            const f = e.target.files?.[0]; if (!f) return;
            if (f.size > 2 * 1024 * 1024) { toast.error("Image must be 2 MB or smaller."); e.target.value = ""; return; }
            const fd = new FormData(); fd.set("file", f); void call({ method: "POST", body: fd }, "Photo updated.").then(() => { e.target.value = ""; });
          }} />
        {logoPath && <button type="button" className="btn-ghost !min-h-[36px]" disabled={busy} onClick={() => call({ method: "DELETE" }, "Photo removed.")}>Remove</button>}
      </div>
    </div>
  );
}
