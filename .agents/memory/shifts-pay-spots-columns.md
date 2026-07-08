---
name: Shifts pay/spots column names
description: The live shifts table's actual pay-rate and spot-count column names, since they differ from what schema.sql/older code assumed.
---

The live `public.shifts` table uses `pay_rate` (numeric) and `spots_available` (int, holds the **total** posted spots, not the remainder) plus `spots_filled`. Remaining spots = `spots_available - spots_filled`.

**Why:** Code (ShiftRow type in `lib/supabase.ts`, `usePostShift`, the post-shift wizards) previously read/wrote `hourly_rate` and `spots`, which don't exist on the live table — pay always displayed as $0 and shift posting/spot math was silently wrong. Confirmed via a live REST query against the real Supabase instance (see schema-sql-drift.md — schema.sql is not authoritative).

**How to apply:** When touching shift pay or spot-count code, use `pay_rate` and `spots_available` (total) / `spots_filled`, not `hourly_rate`/`spots`. Before trusting any column name from schema.sql for this table, verify live via a REST/SQL query.
