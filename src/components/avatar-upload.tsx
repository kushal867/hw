"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export function AvatarUpload() {
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  return (
    <div>
      <label htmlFor="avatar" className="btn-secondary cursor-pointer">{busy ? "Uploading…" : "Change photo"}</label>
      <input id="avatar" type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" disabled={busy} onChange={async (e) => {
        const f = e.target.files?.[0]; if (!f) return;
        if (f.size > 1024 * 1024) return toast.error("Image must be 1 MB or smaller.");
        setBusy(true);
        const fd = new FormData(); fd.set("file", f);
        try { const r = await fetch("/api/avatar", { method: "POST", body: fd }); const j = await r.json(); (r.ok ? toast.success : toast.error)(r.ok ? "Photo updated." : j.message); router.refresh(); }
        catch { toast.error("Network error."); } finally { setBusy(false); e.target.value = ""; }
      }} />
    </div>
  );
}
