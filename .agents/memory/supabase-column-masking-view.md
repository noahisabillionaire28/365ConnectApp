---
name: Column-level privacy needs a definer view, not RLS
description: Postgres RLS is row-level only; hiding a specific column's value from some roles (e.g. negative review tags hidden from workers) requires a view, not a policy.
---

Requirement pattern: "column X on table T must be readable by role A but never by role B" (e.g. `reviews.negative_tags` visible to clients/staffers, never to workers) cannot be expressed as a Row Level Security policy — RLS decides which *rows* are visible, not which *columns* within a visible row. A worker who is allowed to see a review row at all (RLS `USING (true)` or similar) can still request `?select=negative_tags` directly against the base table and get the real value.

**Why:** This was caught by code review as a real data-leak vector even though the UI never rendered the field to workers — the API path bypassed the UI-side role check entirely.

**How to apply:** Create a plain (default) VIEW that computes the masked column with a `CASE WHEN <role check via auth.uid()> THEN real_value ELSE '{}'/NULL END`, then `REVOKE SELECT` on the base table from `authenticated`/`anon` and `GRANT SELECT` on the view instead. The view must NOT use `WITH (security_invoker = true)` in this setup — since the base table's SELECT grant is revoked, an invoker-rights view would fail for every normal user; the view needs the owner's (definer) privileges to read the underlying rows and apply the masking itself. Point every app read path (including screens that don't obviously touch the sensitive field, e.g. a profile screen listing review history) at the view, not the base table, or they'll get a permission-denied error once the base grant is revoked.
