---
name: Edit tool corrupts $ in SQL dollar-quoting
description: Using the Edit tool on PL/pgSQL with $$ dollar-quoting can silently collapse "$$" to "$", producing invalid SQL that only fails at apply time.
---

When writing or editing `.sql` files that use PL/pgSQL dollar-quoting (`AS $$ ... $$;`), the Edit tool's old_string/new_string replacement can silently collapse `$$` down to a single `$` in the written file. This does not error at edit time — it produces syntactically broken SQL that only surfaces when the file is actually applied against a database.

**Why:** Caused every `CREATE FUNCTION ... AS $$ ... $$;` block introduced in one session to lose one `$`, breaking ~10 functions. Silent until SQL apply.

**How to apply:** After any Edit-tool write that touches `$`-quoted SQL blocks, grep for lone `$` where pairs were intended. Prefer `WriteFile` full-file rewrites over Edit-tool patches when adding many `$`-quoted functions in one pass.
