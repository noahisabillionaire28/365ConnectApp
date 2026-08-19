/**
 * Postgres-compatible query shim backed by Supabase.
 *
 * WHY THIS EXISTS
 * ---------------
 * The routes in this server were written against a raw `pg` Pool
 * (`pool.query(text, params) → { rows }`). A direct Postgres connection needs
 * `DATABASE_URL` with the database password — which is not reliably available
 * in the serverless deployment. The Supabase service-role REST client
 * (`adminDb`), however, IS available (it only needs the project URL + service
 * key) and already powers auth.
 *
 * Rather than rewrite ~66 hand-tuned SQL queries (many with JOINs, array
 * operators like `= ANY(...)`, and aggregates that the PostgREST query builder
 * cannot express without changing response shapes), we keep every query
 * verbatim and run it through a single `exec_sql` Postgres function via
 * `adminDb.rpc(...)`. This module exposes a `pool` with the exact
 * `.query(text, params) → { rows, rowCount }` surface the routes already use,
 * so no route logic changes.
 *
 * The matching database function lives in
 *   supabase/migrations/0001_exec_sql.sql
 * and MUST be applied to the database for these queries to work.
 *
 * SECURITY: `exec_sql` is callable only by the service_role (revoked from
 * anon/authenticated), and this client is server-only. Parameters are bound as
 * escaped SQL literals inside the function (via `quote_nullable`), preserving
 * the injection-safety of the original parameterised queries.
 */
import { adminDb } from './supabaseAdmin.js';

/**
 * Serialise a JS value to the text form Postgres expects for an untyped
 * literal. Arrays become Postgres array literals (all columns that receive
 * arrays in this schema are TEXT[]); plain objects become JSON (for JSONB);
 * everything else is stringified. null/undefined pass through as SQL NULL.
 */
function serializeParam(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (Array.isArray(v)) return pgArrayLiteral(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

/** Build a Postgres array literal like {"a","b"} with each element quoted. */
function pgArrayLiteral(arr: unknown[]): string {
  const parts = arr.map((el) => {
    if (el === null || el === undefined) return 'NULL';
    const s = typeof el === 'object' ? JSON.stringify(el) : String(el);
    return '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
  });
  return '{' + parts.join(',') + '}';
}

/** Does this statement return a row set we should collect? */
function returnsRows(sql: string): boolean {
  return /^\s*(select|with)\b/i.test(sql) || /\breturning\b/i.test(sql);
}

export interface QueryResult<T = any> {
  rows: T[];
  rowCount: number;
}

async function query<T = any>(
  text: string,
  params: unknown[] = [],
): Promise<QueryResult<T>> {
  const p_params = (params ?? []).map(serializeParam);
  const { data, error } = await adminDb.rpc('exec_sql', {
    p_query: text,
    p_params,
    p_returns_rows: returnsRows(text),
  });
  if (error) {
    const e = new Error(error.message) as Error & { code?: string };
    e.code = error.code;
    throw e;
  }
  const rows = (Array.isArray(data) ? data : []) as T[];
  return { rows, rowCount: rows.length };
}

/** Drop-in replacement for the `pg` Pool used across the route handlers. */
export const pool = { query };
