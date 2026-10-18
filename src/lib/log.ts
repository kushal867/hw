/**
 * Structured JSON logging (one line per event) so logs can be grepped and shipped as-is.
 * Secrets and personal data are redacted by key name; never pass raw request bodies.
 */
type Level = "debug" | "info" | "warn" | "error";
const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const SENSITIVE = /pass(word)?|token|secret|cookie|authorization|email|session|hash/i;

const min = () => ORDER[(process.env.LOG_LEVEL as Level) in ORDER ? (process.env.LOG_LEVEL as Level) : "info"];

function clean(v: unknown, depth = 0): unknown {
  if (v instanceof Error) return { name: v.name, message: v.message, ...(process.env.NODE_ENV !== "production" ? { stack: v.stack } : {}) };
  if (typeof v === "string") return v.length > 500 ? v.slice(0, 500) + "…" : v;
  if (!v || typeof v !== "object" || depth > 3) return v;
  if (Array.isArray(v)) return v.slice(0, 20).map((x) => clean(x, depth + 1));
  return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, SENSITIVE.test(k) ? "[redacted]" : clean(x, depth + 1)]));
}

export function log(level: Level, event: string, fields: Record<string, unknown> = {}) {
  if (ORDER[level] < min()) return;
  const line = JSON.stringify({ t: new Date().toISOString(), level, event, ...(clean(fields) as object) });
  (level === "error" ? console.error : level === "warn" ? console.warn : console.log)(line);
}
export const logger = {
  debug: (e: string, f?: Record<string, unknown>) => log("debug", e, f),
  info: (e: string, f?: Record<string, unknown>) => log("info", e, f),
  warn: (e: string, f?: Record<string, unknown>) => log("warn", e, f),
  error: (e: string, f?: Record<string, unknown>) => log("error", e, f),
};
