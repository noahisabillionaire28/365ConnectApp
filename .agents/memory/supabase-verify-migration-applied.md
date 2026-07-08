---
name: Verify Supabase SQL migrations actually applied
description: Don't trust that a manually-run schema.sql migration fully succeeded — check live via the PostgREST introspection endpoint per table/column.
---

This project's Supabase schema changes are applied manually by the user pasting `supabase/schema.sql` blocks into the Supabase SQL editor (no automated migration runner). Across sessions, a migration block has been found to have partially applied — some tables in a Phase existed live while a sibling table in the same block did not — most likely because the user's SQL editor run stopped or partially failed on a syntax error partway through (e.g. a single-`$` dollar-quote typo in a later `CREATE FUNCTION` statement), and statements run as independent commands rather than one atomic transaction.

**Why:** Building features against tables/columns that were never actually written live wastes a full session of app work that can't function until the gap is found.

**How to apply:** Never assume "the user probably ran the SQL from last time." Before building on a new schema.sql block, check live via `GET {SUPABASE_URL}/rest/v1/` (the PostgREST OpenAPI doc) and look for the expected table names in `.paths`, or do a cheap `?select=col&limit=1` against a specific new table/column and check the HTTP status (404 = missing) using the `SUPABASE_SERVICE_ROLE_KEY` secret. Direct `psql`/raw Postgres connections are generally not reachable from the sandbox even with `SUPABASE_DB_PASSWORD` (both the direct `db.<ref>.supabase.co` host and the pooler host failed to connect in this environment) — PostgREST introspection is the reliable check.
