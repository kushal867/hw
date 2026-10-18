import { z } from "zod";
import { ApiError } from "@/lib/api-utils";

export const uuid = z.string().uuid("Invalid id.");
/** A malformed id in the URL is a plain 404, never a database error. */
export function uuidParam(params: Record<string, string>, key: string) {
  const r = uuid.safeParse(params[key]);
  if (!r.success) throw new ApiError(404, "not_found", "Not found.");
  return r.data;
}
