import { access, constants } from "fs/promises";
import { NextResponse } from "next/server";
import { adminSql } from "@/lib/db";
import { env } from "@/lib/env";
import { getHub } from "@/lib/chat/hub";

export const dynamic = "force-dynamic";
const withTimeout = <T,>(p: Promise<T>, ms: number) => Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);

/** Liveness + dependency check for load balancers/monitoring. Exposes no secrets or user data. */
export async function GET() {
  const checks: Record<string, "ok" | "fail"> = {};
  try { await withTimeout(adminSql("select 1"), 2000); checks.database = "ok"; } catch { checks.database = "fail"; }
  try { await access(env.storageDir, constants.W_OK); checks.storage = "ok"; } catch { checks.storage = "fail"; }
  const hub = getHub().stats();
  checks.realtime = hub.listening ? "ok" : "fail";
  const healthy = checks.database === "ok" && checks.storage === "ok";                 // realtime degrades gracefully (clients fall back to polling)
  return NextResponse.json({ status: healthy ? "ok" : "degraded", checks, uptimeSeconds: Math.round(process.uptime()), streams: hub.subscribers },
    { status: healthy ? 200 : 503, headers: { "cache-control": "no-store" } });
}
