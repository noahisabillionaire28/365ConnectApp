---
name: Admin API pre-migration fallbacks
description: Pattern for gracefully handling missing columns/tables in the admin API when Phase 11 SQL hasn't been run yet
---

## Rule
Admin API endpoints must not crash when Phase 11 columns (`status` on users, `payment_type`/`net_amount`/`fee` on payments) or tables (`disputes`) don't exist in the live DB yet.

## Pattern
```ts
let { data, error } = await adminDb.from('table').select('col1, new_col, ...');
if (error && isColumnMissingError(error)) {   // code === '42703'
  const fallback = await adminDb.from('table').select('col1, ...');  // without new_col
  data = (fallback.data ?? []).map(r => ({ ...r, new_col: 'default' }));
  error = null;
}
if (error) throw error;
```

For missing tables (disputes):
```ts
if (error && isTableMissingError(error)) { // code PGRST205 or 42P01
  res.json([]);  // graceful empty
  return;
}
```

## Why
The Supabase live DB requires the user to manually run migration SQL. Between code deploy and migration run, the API must serve gracefully — crashing blocks the entire admin panel.

## How to apply
- Any new column added in a schema phase → add column-missing fallback in the API endpoint that selects it
- Any new table → add table-missing fallback returning `[]`
- The helper functions `isColumnMissingError` and `isTableMissingError` are defined at the top of `artifacts/api-server/src/routes/admin.ts`
