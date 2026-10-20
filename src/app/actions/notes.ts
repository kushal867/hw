"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/server-db";
import { isUuid } from "@/lib/group";
import type { ActionResult } from "@/components/ui/action-form";

/** Save / unsave a public note to the signed-in user's list. Row-level security guarantees it is a published note and a private list. */
export async function toggleSaveNote(docId: string, save: boolean): Promise<ActionResult> {
  const { user } = await requireUser();
  if (!isUuid(docId)) return { ok: false, message: "Invalid note." };
  const db = await createClient();
  const r = save ? await db.from("note_saves").insert({ user_id: user.id, document_id: docId }) : await db.from("note_saves").delete().eq("user_id", user.id).eq("document_id", docId);
  if (r.error && r.error.code !== "23505") return { ok: false, message: "Could not update your saved notes." };
  revalidatePath("/saved");
  return { ok: true, message: save ? "Saved to your list." : "Removed from your saved notes.", data: { saved: save } };
}
