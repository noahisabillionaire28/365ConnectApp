---
name: Cross-user writes need SECURITY DEFINER triggers
description: RLS blocks a user from inserting/updating rows owned by a different user_id — use a SECURITY DEFINER trigger on the source table instead of a client-side insert.
---

When one user's action needs to write a row scoped to a *different* user (e.g. worker applies → client gets a notification row with `user_id = client_id`), a client-side insert from the worker's session will be rejected by RLS, since the worker isn't `auth.uid() = user_id` for that row.

**Why:** RLS INSERT policies are evaluated against the inserting session's `auth.uid()`, not the row's semantic owner. There is no clean RLS policy that allows "insert a row for someone else only when a specific business condition holds" without effectively allowing arbitrary spoofing.

**How to apply:** Write these rows via a `SECURITY DEFINER` Postgres trigger function on the table that already has a legitimate insert/update from the acting user (e.g. `AFTER INSERT ON applications`), not a client-side `supabase.from('notifications').insert(...)`. Do not give the target table (e.g. `notifications`) a client-side INSERT policy at all — the trigger is the only writer. Similarly, restrict `UPDATE ... WITH CHECK` on shared tables like `applications` so a worker can only move their own row to a self-serve status (e.g. `withdrawn`), while the owning side (client) is the only one allowed to set `accepted`/`declined` — don't rely on the `USING` clause alone, since it only gates row visibility, not the new values being written.

Also: when writing multi-line PL/pgSQL functions with `$...$` dollar-quoting in a schema.sql file meant to be pasted into the Supabase SQL editor, always use `$$` (double dollar), never a single `$` — a single `$` is not valid dollar-quote syntax and silently breaks that CREATE FUNCTION statement (and anything after it in the same implicit transaction) without erroring the whole file if run in chunks.
