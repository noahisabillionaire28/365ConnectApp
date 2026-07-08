---
name: CREATE POLICY IF NOT EXISTS invalid in Postgres
description: Correct idempotent RLS policy creation pattern for schema.sql
---

## Rule
`CREATE POLICY IF NOT EXISTS` is **not valid PostgreSQL syntax** and will fail silently or with an error in Supabase.

## Correct pattern (used throughout schema.sql)
```sql
DO $$ BEGIN
  CREATE POLICY "policy_name" ON public.table FOR [ALL|SELECT|INSERT|UPDATE|DELETE]
    USING (...);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
```

## Why
Supabase runs on standard PostgreSQL which does not support `IF NOT EXISTS` for policies (unlike tables/indexes). The DO/EXCEPTION pattern is idempotent and safe to re-run on existing databases.

## How to apply
Always use the DO/EXCEPTION wrapper when adding any new RLS policy to schema.sql. Never write `CREATE POLICY IF NOT EXISTS`.
