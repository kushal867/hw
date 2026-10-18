"use client";
import { useState } from "react";
import { Globe, Lock } from "lucide-react";

/** Public/Private as two selectable cards; the join-policy choice only appears for public groups. */
export function VisibilityFields({ defaultVisibility = "public", defaultPolicy = "approval" }: { defaultVisibility?: "public" | "private"; defaultPolicy?: "open" | "approval" }) {
  const [vis, setVis] = useState<"public" | "private">(defaultVisibility);
  const card = (active: boolean) => `flex cursor-pointer gap-3 rounded-2xl border-2 p-4 transition ${active ? "border-brand-600 bg-brand-50/60" : "border-line bg-surface hover:border-brand-200"}`;
  return (
    <>
      <fieldset>
        <legend className="label">Who can find this group?</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={card(vis === "public")}><input type="radio" name="visibility" value="public" checked={vis === "public"} onChange={() => setVis("public")} className="sr-only" />
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-brand-600 shadow-sm"><Globe className="h-5 w-5" aria-hidden /></span>
            <span><span className="block font-bold">Public</span><span className="mt-0.5 block text-sm leading-snug text-muted">Anyone can find it in Find Groups. Files and discussions stay visible to members only.</span></span></label>
          <label className={card(vis === "private")}><input type="radio" name="visibility" value="private" checked={vis === "private"} onChange={() => setVis("private")} className="sr-only" />
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-slate-600 shadow-sm"><Lock className="h-5 w-5" aria-hidden /></span>
            <span><span className="block font-bold">Private</span><span className="mt-0.5 block text-sm leading-snug text-muted">Hidden from search. People join only with your invitation link or QR code.</span></span></label>
        </div>
      </fieldset>
      {vis === "public" && (
        <div><label htmlFor="join_policy" className="label">How do people join?</label>
          <select id="join_policy" name="join_policy" defaultValue={defaultPolicy} className="input"><option value="approval">They request, and I approve</option><option value="open">Anyone can join instantly</option></select></div>)}
    </>
  );
}
