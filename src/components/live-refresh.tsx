"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Re-fetches server data periodically while the tab is visible, so new posts and replies appear without a manual reload. */
export function LiveRefresh({ seconds = 15 }: { table?: string; filter?: string; seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => { if (document.visibilityState === "visible") router.refresh(); }, seconds * 1000);
    return () => clearInterval(id);
  }, [seconds, router]);
  return null;
}
