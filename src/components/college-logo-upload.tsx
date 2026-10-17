"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export function CollegeLogoUpload({ collegeId }: { collegeId: string }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  return (
    <label className={`btn-secondary !min-h-[34px] cursor-pointer text-xs ${busy ? "opacity-50" : ""}`}>{busy ? "Uploading…" : "Upload logo"}
      <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" disabled={busy} onChange={async (e) => {
        const f = e.target.files?.[0]; if (!f) return;
        if (f.size > 2 * 1024 * 1024) return toast.error("Image must be 2 MB or smaller.");
        setBusy(true);
        const fd = new FormData(); fd.set("file", f); fd.set("collegeId", collegeId);
        try { const r = await fetch("/api/admin/college-logo", { method: "POST", body: fd }); const j = await r.json(); (r.ok ? toast.success : toast.error)(r.ok ? "Logo updated." : j.message); router.refresh(); }
        catch { toast.error("Network error."); } finally { setBusy(false); e.target.value = ""; }
      }} />
    </label>
  );
}
