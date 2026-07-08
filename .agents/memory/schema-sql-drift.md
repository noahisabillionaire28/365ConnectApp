---
name: schema.sql can drift from the live DB
description: The Supabase schema.sql file in the repo may not match what's actually applied in the live database — always verify before trusting it.
---

`supabase/schema.sql` is a design document, not a guarantee of the live database state. Migrations added to it are not auto-applied — Replit's shell has no network path to run them against Supabase, so someone must paste them into the Supabase Dashboard SQL Editor manually.

**Why:** During Section 3 development, new columns (`users.lat/lng`, `primary_job_type`, etc.) were added to schema.sql and code was written assuming they existed, but a live query against the actual Supabase REST API returned `42703 column does not exist` — the migration had never been run.

**How to apply:** Before trusting any `.select()`/`.insert()` call that references a "new" or recently-added column, do a quick live check (e.g. a REST fetch or `execute_sql`) against the real database rather than assuming schema.sql is current. When adding new columns that other code will depend on, add explicit `42703` fallback branches so the app degrades gracefully instead of crashing until the migration is actually run.
