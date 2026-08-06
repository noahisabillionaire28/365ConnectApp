import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set. Did you forget to provision a database?");
}

// Global PostgreSQL type parsers.
// node-postgres returns NUMERIC/DECIMAL (OID 1700) as strings by default, which
// breaks client code that expects numbers (e.g. rating.toFixed(...)). Register a
// single global parser so every query across the API returns real numbers.
// bigint (OID 20) is intentionally left as-is to avoid precision loss.
pg.types.setTypeParser(1700, (value) => (value === null ? null : parseFloat(value)));

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });

export * from "./schema";
