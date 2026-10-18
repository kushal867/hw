"use client";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** The full cover header suits browsing; on the Chat tab it would push the message box off-screen, so a slim bar replaces it. */
export function GroupChrome({ id, full, compact }: { id: string; full: ReactNode; compact: ReactNode }) {
  const path = usePathname();
  return <>{path === `/groups/${id}/chat` ? compact : full}</>;
}
