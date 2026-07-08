---
name: Edit tool corrupts $$ in SQL dollar-quoting
description: Using the Edit tool to write/append PL/pgSQL with $$ dollar-quoting can silently collapse "$$" to "$", producing invalid SQL that only fails at apply time.
---

When writing or editing `.sql` files that use PL/pgSQL dollar-quoting (`AS $$ ... $$;`), the Edit tool's
old_string/new_string replacement can silently collapse `$$` down to a single `$` in the written file
(consistent with `String.replace` treating `$$` in a replacement string as an escaped literal `$`).
This does not error at edit time — it produces syntactically broken SQL (`AS $` / `$;`) that only
surfaces when the file is actually applied against a database.

**Why:** This caused every `CREATE FUNCTION ... AS $$ ... $$;` block introduced across two separate
large Edit calls in one session to lose one `$` from each pair, breaking ~10 functions and a
`cron.schedule(...)` comment string across the file. It was silent until an architect review /
actual SQL apply caught it — `pnpm tsc` and the running app gave no signal since this is a `.sql`
file the frontend never parses.

**How to apply:** After any Edit-tool write that introduces or touches `$$`-quoted SQL blocks, run
`grep -n 'AS \$$\|^\$;$'` (or similar) over the changed range to check for lone `$` where `$$` was
intended, and actually apply the file end-to-end against a scratch Postgres instance
(`initdb`/`pg_ctl start` in `/tmp`, stub `auth`/`storage` schemas + `authenticated`/`anon` roles,
`psql -v ON_ERROR_STOP=1 -f schema.sql`) before trusting that a Supabase schema.sql is correct.
Prefer `$tag$...$tag$` unique-tagged dollar-quoting or WriteFile-based full-file rewrites over
Edit-tool patches when adding many `$$`-quoted functions in one pass, to sidestep the bug entirely.
