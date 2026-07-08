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

**How to apply:** After any Edit-tool write that introduces or touches `$`-quoted SQL blocks, run
`grep -n 'AS \$\|^\$;
` (or similar) over the changed range to check for lone `---
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

 where `$` was
intended, and actually apply the file end-to-end against a scratch Postgres instance
(`initdb`/`pg_ctl start` in `/tmp`, stub `auth`/`storage` schemas + `authenticated`/`anon` roles,
`psql -v ON_ERROR_STOP=1 -f schema.sql`) before trusting that a Supabase schema.sql is correct.
Prefer `$tag$...$tag---
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

 unique-tagged dollar-quoting or WriteFile-based full-file rewrites over
Edit-tool patches when adding many `$`-quoted functions in one pass, to sidestep the bug entirely.

Recurrence confirmed a third time in a later session (this time on the *same* `notify_shift_request_created` function body, just from an unrelated Edit to its content) — this is a recurring hazard on this file, not a one-off, expect it on essentially any Edit-tool touch to `$`-quoted SQL.

Recurrence confirmed in a later session: it struck again on a single new `Edit` call adding one
new `$`-quoted function (not just large multi-function edits), and separately, on a different
edit in the same file, a literal `---
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

 inside a string body (not dollar-quoting) triggered the Edit
tool to truncate/duplicate a large trailing chunk of the file. Treat *any* literal `---
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

 character
in Edit `old_string`/`new_string` SQL content as risky, not just `$` pairs — prefer building such
literals via `chr(36)` in the SQL itself, or writing the block with a plain shell `sed`/`cat`
heredoc instead of the Edit tool when a literal `---
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

 is unavoidable.
