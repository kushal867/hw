"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/** Refreshes server data when new rows arrive. Realtime applies RLS per subscriber, so only authorised members get events. */
export function LiveRefresh({ table, filter }: { table: string; filter: string }) {
  const router = useRouter();
  useEffect(() => {
    const supabase = createClient();
    const ch = supabase.channel(`${table}:${filter}`).on("postgres_changes", { event: "*", schema: "public", table, filter }, () => router.refresh()).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [table, filter, router]);
  return null;
}
