/**
 * Coerce a possibly-string numeric value into a finite number.
 *
 * PostgreSQL NUMERIC/DECIMAL columns are serialized as strings by node-postgres,
 * and API payloads can also contain null/undefined. This helper guarantees a
 * finite number so downstream code (e.g. `.toFixed()`) never crashes the UI.
 */
export function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : fallback;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

