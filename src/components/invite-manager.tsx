"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Copy } from "lucide-react";
import { createInvite } from "@/app/actions/groups";

export function InviteManager({ groupId }: { groupId: string }) {
  const [pending, start] = useTransition();
  const [created, setCreated] = useState<{ url: string; qr: string } | null>(null);
  return (
    <div className="space-y-4">
      <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => {
        e.preventDefault(); const fd = new FormData(e.currentTarget);
        start(async () => {
          const r = await createInvite(groupId, fd);
          (r.ok ? toast.success : toast.error)(r.message ?? "");
          if (r.ok) setCreated(r.data as { url: string; qr: string });
        });
      }}>
        <div><label htmlFor="hours" className="label">Expires after</label>
          <select id="hours" name="hours" className="input" defaultValue="168"><option value="24">24 hours</option><option value="168">7 days</option><option value="720">30 days</option><option value="2160">90 days</option></select></div>
        <div><label htmlFor="maxUses" className="label">Maximum uses</label><input id="maxUses" name="maxUses" type="number" min={1} max={1000} placeholder="Unlimited" className="input" /></div>
        <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" name="approval" /> Require moderator approval for each join</label>
        <button className="btn-primary sm:col-span-2" disabled={pending}>{pending ? "Creating…" : "Create Invitation"}</button>
      </form>
      {created && (
        <div className="card flex flex-col items-center gap-3 p-5 sm:flex-row" role="status">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={created.qr} alt="QR code for the invitation link" width={160} height={160} className="rounded-control border border-line" />
          <div className="min-w-0 flex-1 space-y-2">
            <p className="text-sm font-semibold">Share this link or QR code</p>
            <input readOnly value={created.url} className="input" aria-label="Invitation link" onFocus={(e) => e.currentTarget.select()} />
            <button className="btn-secondary" onClick={async () => { await navigator.clipboard.writeText(created.url); toast.success("Link copied"); }}><Copy className="h-4 w-4" aria-hidden />Copy link</button>
            <p className="text-xs text-muted">For security this link is shown only once. Create a new invitation if you lose it.</p>
          </div>
        </div>)}
    </div>
  );
}
