---
name: Live Supabase DB is not directly reachable from this sandbox
description: Direct psql/pg connections to the project's live Supabase Postgres fail from this environment; manual dashboard SQL execution is the only path for schema migrations.
---

The direct Supabase Postgres host is IPv6-only and unreachable from this sandbox. Guessing pooler
hostnames for likely regions (e.g. us-east-1, us-west-1) also failed with "Tenant or user not
found," meaning the project's actual pooler region wasn't guessable from the sandbox alone.

**Why:** Without a real region/pooler hostname (which isn't exposed via the available secrets),
there is no way to open a direct SQL session to the live database from here.

**How to apply:** Don't spend time guessing pooler regions. For any schema change, hand the user
the exact SQL to run in the Supabase SQL editor, then verify it applied afterward via a live
PostgREST query (`select` against the new table/column, or checking for the expected error going
away) rather than trying to `psql` in directly. Use a local scratch Postgres instance only to
verify the SQL's *syntax* applies cleanly before handing it over — never to apply it live.
