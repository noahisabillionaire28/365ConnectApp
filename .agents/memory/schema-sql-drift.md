---
name: schema.sql can drift from the live DB
description: The Supabase schema.sql file in the repo may not match what's actually applied in the live database — always verify before trusting it.
---

`supabase/schema.sql` is a design document, not a guarantee of the live database state. Migrations added to it are not auto-applied — Replit's shell has no network path to run them against Supabase, so someone must paste them into the Supabase Dashboard SQL Editor manually.

**Why:** During Section 3 development, new columns (`users.lat/lng`, `primary_job_type`, etc.) were added to schema.sql and code was written assuming they existed, but a live query against the actual Supabase REST API returned `42703 column does not exist` — the migration had never been run.

**How to apply:** Before trusting any `.select()`/`.insert()` call that references a "new" or recently-added column, do a quick live check (e.g. a REST fetch or `execute_sql`) against the real database rather than assuming schema.sql is current. When adding new columns that other code will depend on, add explicit `42703` fallback branches so the app degrades gracefully instead of crashing until the migration is actually run.

**Confirmed second instance:** `shifts.hourly_rate`/`shifts.spots` in schema.sql do not exist live — the live table has `pay_rate` and `spots_available`/`spots_filled` instead (renamed at some point without schema.sql being updated). This caused pay rate to silently render as $0 everywhere it was read via the old column name. `spots`/`spots_filled` in insert/read code paths were flagged as carrying the same unverified risk and were NOT fixed — check live columns before trusting `spots` math or inserts.
