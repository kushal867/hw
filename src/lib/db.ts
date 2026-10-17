import "server-only";
import { Pool, types, type QueryResult } from "pg";

// Match PostgREST JSON: timestamps as ISO strings, bigint as numbers.
types.setTypeParser(1184, (v) => new Date(v).toISOString());
types.setTypeParser(1114, (v) => new Date(v + "Z").toISOString());
types.setTypeParser(20, (v) => Number(v));

/**
 * Minimal PostgREST-style query builder over node-postgres.
 * Every query runs in its own transaction as a database role (`authenticated` / `anon` / `service_role`) with
 * `request.jwt.claim.sub` set, so Row Level Security and `auth.uid()` behave exactly as the policies expect.
 */

declare global { var __esPool: Pool | undefined; var __esRels: Promise<Rel[]> | undefined; }
const pool = (globalThis.__esPool ??= new Pool({ connectionString: process.env.DATABASE_URL, max: 10 }));

export type DbError = { code?: string; message: string; details?: string };
/** Rows are loosely typed (like an untyped PostgREST client): arrays for lists, objects after single()/maybeSingle(). */
type Row = any[] & { [key: string]: any };
export type DbResult<T = Row> = { data: T; error: DbError | null; count: number | null };
type Role = "anon" | "authenticated" | "service_role";
type Scope = { role: Role; uid: string | null };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const IDENT = /^[a-z_][a-z0-9_]*$/i;
const ident = (s: string) => { if (!IDENT.test(s)) throw new Error(`Invalid identifier: ${s}`); return `"${s}"`; };

async function exec(scope: Scope, sql: string, params: unknown[] = []): Promise<QueryResult> {
  const uid = scope.uid && UUID.test(scope.uid) ? scope.uid : "";
  const c = await pool.connect();
  try {
    await c.query(`BEGIN; SET LOCAL ROLE ${scope.role}; SELECT set_config('request.jwt.claim.sub', '${uid}', true)`);
    const r = await c.query(sql, params);
    await c.query("COMMIT");
    return r;
  } catch (e) {
    await c.query("ROLLBACK").catch(() => {});
    throw e;
  } finally { c.release(); }
}

/** Expected business-rule failures (unique/FK/check/RLS/raised exceptions) stay quiet; anything else is logged for operators. */
const QUIET = /^(23|42501|P0001|PGRST)/;
const toError = (e: any): DbError => {
  if (!QUIET.test(e?.code ?? "")) console.error("[db]", e?.code ?? "", e?.message ?? e);
  return { code: e?.code, message: e?.message ?? "Database error", details: e?.detail };
};

// ───────── Relationship discovery (foreign keys) ─────────
type Rel = { name: string; table: string; cols: string[]; refTable: string; refCols: string[] };
function relations(): Promise<Rel[]> {
  return (globalThis.__esRels ??= pool.query(`
    select c.conname as name, t.relname as "table", rt.relname as "refTable",
      (select array_agg(a.attname::text order by k.ord) from unnest(c.conkey) with ordinality k(attnum, ord) join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum) as cols,
      (select array_agg(a.attname::text order by k.ord) from unnest(c.confkey) with ordinality k(attnum, ord) join pg_attribute a on a.attrelid = c.confrelid and a.attnum = k.attnum) as "refCols"
    from pg_constraint c join pg_class t on t.oid = c.conrelid join pg_class rt on rt.oid = c.confrelid
    join pg_namespace n on n.oid = t.relnamespace and n.nspname = 'public'
    where c.contype = 'f'`).then((r) => r.rows as Rel[]));
}

// ───────── select() parsing:  "id, courses(id,name,colleges(name)), reporter:profiles!fk_name(display_name)" ─────────
type Item = { kind: "col"; name: string; alias?: string } | { kind: "embed"; key: string; table: string; hint?: string; inner: boolean; items: Item[]; count: boolean };

function splitTop(s: string): string[] {
  const out: string[] = []; let depth = 0, cur = "";
  for (const ch of s) {
    if (ch === "(") depth++; if (ch === ")") depth--;
    if (ch === "," && depth === 0) { out.push(cur); cur = ""; } else cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out.map((x) => x.trim()).filter(Boolean);
}
function parseSelect(s: string): Item[] {
  return splitTop(s).map((part): Item => {
    const open = part.indexOf("(");
    if (open === -1) {
      const [alias, name] = part.includes(":") ? part.split(":") : [undefined, part];
      return { kind: "col", name: name.trim(), alias: alias?.trim() };
    }
    let head = part.slice(0, open).trim(); const body = part.slice(open + 1, part.lastIndexOf(")")).trim();
    let alias: string | undefined; if (head.includes(":")) [alias, head] = head.split(":").map((x) => x.trim());
    const [table, ...flags] = head.split("!");
    const inner = flags.includes("inner"); const hint = flags.find((f) => f !== "inner");
    const count = body === "count";
    return { kind: "embed", key: alias ?? table, table, hint, inner, items: count ? [] : parseSelect(body), count };
  });
}

type Filter = { col: string; op: "eq" | "neq" | "is" | "in" | "ilike" | "gte"; val: unknown };

class Builder implements PromiseLike<DbResult> {
  private action: "select" | "insert" | "update" | "delete" = "select";
  private cols = "*"; private selected = true;
  private filters: Filter[] = []; private orders: { col: string; asc: boolean }[] = [];
  private lim: number | null = null; private off = 0;
  private payload: any = null; private head = false; private wantCount = false;
  private mode: "many" | "single" | "maybe" = "many";

  constructor(private scope: Scope, private table: string) {}

  select(cols = "*", opts?: { count?: "exact"; head?: boolean }) {
    this.cols = cols; this.selected = true;
    if (opts?.count) this.wantCount = true; if (opts?.head) this.head = true;
    return this;
  }
  insert(values: object | object[]) { this.action = "insert"; this.payload = values; this.selected = false; return this; }
  update(values: object) { this.action = "update"; this.payload = values; this.selected = false; return this; }
  delete() { this.action = "delete"; this.selected = false; return this; }

  eq(col: string, val: unknown) { this.filters.push({ col, op: "eq", val }); return this; }
  neq(col: string, val: unknown) { this.filters.push({ col, op: "neq", val }); return this; }
  is(col: string, val: null | boolean) { this.filters.push({ col, op: "is", val }); return this; }
  in(col: string, val: unknown[]) { this.filters.push({ col, op: "in", val }); return this; }
  ilike(col: string, val: string) { this.filters.push({ col, op: "ilike", val }); return this; }
  gte(col: string, val: unknown) { this.filters.push({ col, op: "gte", val }); return this; }
  order(col: string, opts?: { ascending?: boolean }) { this.orders.push({ col, asc: opts?.ascending !== false }); return this; }
  limit(n: number) { this.lim = n; return this; }
  range(from: number, to: number) { this.off = from; this.lim = to - from + 1; return this; }
  single() { this.mode = "single"; return this; }
  maybeSingle() { this.mode = "maybe"; return this; }

  then<R1 = DbResult, R2 = never>(ok?: ((v: DbResult) => R1 | PromiseLike<R1>) | null, bad?: ((r: unknown) => R2 | PromiseLike<R2>) | null) {
    return this.run().then(ok, bad);
  }

  // ───── SQL generation ─────
  private params: unknown[] = [];
  private p(v: unknown) { this.params.push(v); return `$${this.params.length}`; }
  private n = 0;

  /** Join condition between a parent table alias and an embedded table alias. */
  private joinCond(rel: Rel, toOne: boolean, parentAlias: string, childAlias: string) {
    // toOne: parent holds the FK (rel.table = parent). Otherwise the child holds it.
    return rel.cols.map((c, i) => toOne
      ? `${childAlias}.${ident(rel.refCols[i])} = ${parentAlias}.${ident(c)}`
      : `${childAlias}.${ident(c)} = ${parentAlias}.${ident(rel.refCols[i])}`).join(" and ");
  }
  private async resolve(parent: string, e: Extract<Item, { kind: "embed" }>) {
    const rels = await relations();
    const byHint = (r: Rel) => !e.hint || r.name === e.hint;
    const toOne = rels.find((r) => r.table === parent && r.refTable === e.table && byHint(r));
    if (toOne) return { rel: toOne, toOne: true };
    const toMany = rels.find((r) => r.table === e.table && r.refTable === parent && byHint(r));
    if (toMany) return { rel: toMany, toOne: false };
    throw new Error(`No relationship between ${parent} and ${e.table}`);
  }

  private async exprs(table: string, alias: string, items: Item[]): Promise<string[]> {
    const out: string[] = [];
    for (const it of items) {
      if (it.kind === "col") {
        if (it.name === "*") out.push(`${alias}.*`);
        else out.push(`${alias}.${ident(it.name)}${it.alias ? ` as ${ident(it.alias)}` : ""}`);
        continue;
      }
      const { rel, toOne } = await this.resolve(table, it);
      const ca = `t${++this.n}`;
      const cond = this.joinCond(rel, toOne, alias, ca);
      if (it.count) {
        out.push(`jsonb_build_array(jsonb_build_object('count', (select count(*)::int from ${ident(it.table)} ${ca} where ${cond}))) as ${ident(it.key)}`);
        continue;
      }
      const inner = (await this.exprs(it.table, ca, it.items)).join(", ");
      const sub = `(select ${inner} from ${ident(it.table)} ${ca} where ${cond})`;
      out.push(toOne
        ? `(select to_jsonb(x) from ${sub} x limit 1) as ${ident(it.key)}`
        : `coalesce((select jsonb_agg(to_jsonb(x)) from ${sub} x), '[]'::jsonb) as ${ident(it.key)}`);
    }
    return out;
  }

  private cond(expr: string, f: Filter): string {
    switch (f.op) {
      case "eq": return `${expr} = ${this.p(f.val)}`;
      case "neq": return `${expr} <> ${this.p(f.val)}`;
      case "gte": return `${expr} >= ${this.p(f.val)}`;
      case "ilike": return `${expr} ilike ${this.p(f.val)}`;
      case "in": return `${expr} = any(${this.p(f.val)})`;
      case "is": return f.val === null ? `${expr} is null` : `${expr} is ${f.val ? "true" : "false"}`;
    }
  }

  private async where(table: string, alias: string, items: Item[]): Promise<string> {
    const parts: string[] = [];
    for (const f of this.filters) {
      if (!f.col.includes(".")) { parts.push(this.cond(`${alias}.${ident(f.col)}`, f)); continue; }
      // Filter on an embedded table: EXISTS over the related rows.
      const [embedKey, col] = f.col.split(".");
      const e = items.find((i): i is Extract<Item, { kind: "embed" }> => i.kind === "embed" && i.key === embedKey);
      if (!e) throw new Error(`Unknown embedded filter: ${f.col}`);
      const { rel, toOne } = await this.resolve(table, e);
      const ca = `f${++this.n}`;
      parts.push(`exists (select 1 from ${ident(e.table)} ${ca} where ${this.joinCond(rel, toOne, alias, ca)} and ${this.cond(`${ca}.${ident(col)}`, f)})`);
    }
    // !inner embeds require at least one related row.
    for (const e of items) {
      if (e.kind !== "embed" || !e.inner) continue;
      const { rel, toOne } = await this.resolve(table, e);
      const ca = `i${++this.n}`;
      parts.push(`exists (select 1 from ${ident(e.table)} ${ca} where ${this.joinCond(rel, toOne, alias, ca)})`);
    }
    return parts.length ? ` where ${parts.join(" and ")}` : "";
  }

  private async build(): Promise<{ sql: string; countSql?: string }> {
    const t = ident(this.table); const items = parseSelect(this.cols);
    if (this.action === "select") {
      const w = await this.where(this.table, "t0", items);
      const from = `from ${t} t0${w}`;
      const countSql = this.head || this.wantCount ? `select count(*)::int as c ${from}` : undefined;
      if (this.head) return { sql: countSql!, countSql };
      const ord = this.orders.length ? ` order by ${this.orders.map((o) => `t0.${ident(o.col)} ${o.asc ? "asc" : "desc"}`).join(", ")}` : "";
      const lim = this.lim !== null ? ` limit ${Math.max(0, Math.floor(this.lim))} offset ${Math.max(0, Math.floor(this.off))}` : "";
      const sel = (await this.exprs(this.table, "t0", items)).join(", ");
      return { sql: `select ${sel} ${from}${ord}${lim}`, countSql };
    }

    let mutation: string;
    if (this.action === "insert") {
      const rows: Record<string, unknown>[] = Array.isArray(this.payload) ? this.payload : [this.payload];
      const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
      const values = rows.map((r) => `(${cols.map((c) => (c in r ? this.p(r[c]) : "default")).join(", ")})`).join(", ");
      mutation = `insert into ${t} (${cols.map(ident).join(", ")}) values ${values} returning *`;
    } else {
      if (!this.filters.length) throw new Error(`Refusing to ${this.action} ${this.table} without a filter`);
      if (this.action === "update") {
        const entries = Object.entries(this.payload as object);
        mutation = `update ${t} t0 set ${entries.map(([k, v]) => `${ident(k)} = ${this.p(v)}`).join(", ")}${await this.where(this.table, "t0", [])} returning t0.*`;
      } else {
        mutation = `delete from ${t} t0${await this.where(this.table, "t0", [])} returning t0.*`;
      }
    }
    if (!this.selected) return { sql: mutation };
    const sel = (await this.exprs(this.table, "t0", items)).join(", ");
    return { sql: `with r as (${mutation}) select ${sel} from r t0` };
  }

  private async run(): Promise<DbResult> {
    try {
      const { sql, countSql } = await this.build();
      const r = await exec(this.scope, sql, this.params);
      let count: number | null = null;
      if (this.action === "select" && countSql) {
        count = this.head ? r.rows[0].c : (await exec(this.scope, countSql, this.params)).rows[0].c;
      }
      if (this.head) return { data: null as any, error: null, count };
      if (this.action !== "select" && !this.selected) return { data: null as any, error: null, count: null };
      const rows = r.rows;
      if (this.mode === "many") return { data: rows, error: null, count };
      if (rows.length === 1) return { data: rows[0], error: null, count };
      if (rows.length === 0 && this.mode === "maybe") return { data: null as any, error: null, count };
      return { data: null as any, error: { code: "PGRST116", message: rows.length ? "Multiple rows returned" : "No rows returned" }, count };
    } catch (e) {
      return { data: null as any, error: toError(e), count: null };
    }
  }
}

export type Db = {
  from: (table: string) => Builder;
  rpc: (fn: string, args?: Record<string, unknown>) => PromiseLike<DbResult<any>>;
};

function client(scope: Scope): Db {
  return {
    from: (table) => new Builder(scope, table),
    rpc: (fn, args = {}) => ({
      then(ok, bad) {
        const keys = Object.keys(args);
        const sql = `select public.${ident(fn)}(${keys.map((k, i) => `${ident(k)} => $${i + 1}`).join(", ")}) as r`;
        return exec(scope, sql, keys.map((k) => args[k]))
          .then((r): DbResult<any> => ({ data: r.rows[0]?.r === "" ? null : r.rows[0]?.r ?? null, error: null, count: null }))
          .catch((e): DbResult<any> => ({ data: null as any, error: toError(e), count: null }))
          .then(ok, bad);
      },
    }),
  };
}

/** Trusted server code: bypasses RLS. Authorise the caller yourself first. */
export const createAdminClient = () => client({ role: "service_role", uid: null });
/** Acts as a specific user (RLS applies). `null` = anonymous visitor. */
export const clientFor = (userId: string | null) => client(userId ? { role: "authenticated", uid: userId } : { role: "anon", uid: null });

/** Raw SQL as the service role, for auth tables that the PostgREST-style builder doesn't model. */
export async function adminSql<T = any>(sql: string, params: unknown[] = []): Promise<T[]> {
  return (await exec({ role: "service_role", uid: null }, sql, params)).rows as T[];
}
export { toError };
