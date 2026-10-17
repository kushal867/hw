import "server-only";
import { createHash, randomBytes } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

/** 256-bit URL-safe random token. Only its SHA-256 hash is stored. */
export const newInviteToken = () => randomBytes(32).toString("base64url");
export const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");
export const sha256 = (b: Buffer) => createHash("sha256").update(b).digest("hex");

/** Server-side rate limit. Returns false when the caller is over budget. */
export async function allow(userId: string, bucket: string, max: number, windowSeconds: number) {
  const { data, error } = await createAdminClient().rpc("check_rate_limit", {
    p_user: userId, p_bucket: bucket, p_max: max, p_window_seconds: windowSeconds,
  });
  return error ? false : data === true; // fail closed
}

export async function audit(actor: string | null, action: string, targetType: string, targetId: string, metadata: object = {}) {
  await createAdminClient().from("audit_logs").insert({ actor_id: actor, action, target_type: targetType, target_id: targetId, metadata });
}

/** Validate real PDF content (magic bytes + EOF marker), never the extension or client MIME type. */
export function looksLikePdf(buf: Buffer) {
  if (buf.length < 8 || buf.subarray(0, 5).toString("latin1") !== "%PDF-") return false;
  const tail = buf.subarray(Math.max(0, buf.length - 2048)).toString("latin1");
  if (!tail.includes("%%EOF")) return false;
  // Reject PDFs that embed launchable actions/scripts; these have no place in study notes.
  const head = buf.toString("latin1");
  return !/\/(JavaScript|JS|Launch|EmbeddedFile)\b/.test(head);
}
