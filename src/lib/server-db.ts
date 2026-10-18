import "server-only";
import { cache } from "react";
import { clientFor } from "@/lib/db";
import { getSessionUser } from "@/lib/session";

/** Request-scoped client: acts as the signed-in user (or anonymous), so RLS applies. */
export const createClient = cache(async () => clientFor((await getSessionUser())?.id ?? null));
