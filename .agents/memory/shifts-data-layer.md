---
name: Shifts data layer
description: Architecture decisions for the live shifts data layer (Task #1) — adapter, hooks, seed, schema.
---

## Rule
Any screen that receives a Supabase UUID must use `useShiftById` from `src/hooks/useShifts.ts`, never `MOCK_SHIFTS.find()`. MOCK_SHIFTS IDs are short strings; Supabase IDs are UUIDs — they never intersect.

**Why:** ClockInScreen originally used `MOCK_SHIFTS.find(s => s.id === id)`, which always returned `undefined` when navigated to from ShiftDetailScreen (which now passes Supabase UUIDs). Caused silent "Shift not found" failures.

**How to apply:** When adding any new screen that receives a shift ID via URL params, import `useShiftById` and handle `isLoading`, `error`, and `!data` as three separate states (loading spinner, error+retry, notFound message).

## Phase 2 SQL dependency
The seed server and the `useShifts` hook work against the base schema (5 tables), but the 8 demo shifts **cannot be seeded** until the Phase 2 `ALTER TABLE shifts ADD COLUMN IF NOT EXISTS ...` block is applied in the Supabase SQL editor. The seed server prints a warning and exits gracefully if columns are missing.

Run this from `supabase/schema.sql` (the section after "Phase 2 additions" comment) before expecting any shift data.

## Adapter pattern
`shiftRowToMockShift(row: ShiftRow): MockShift` in `src/lib/supabase.ts` converts the DB row to the UI shape. All existing card/list components consume `MockShift` unchanged. The adapter fills null DB columns with safe defaults so no UI component ever receives undefined for a required field.

## Real-time
`useShifts` subscribes to Supabase channel `shifts-realtime` for `INSERT` events and calls `queryClient.invalidateQueries`. The cleanup in `useEffect` calls `supabase.removeChannel(channel)`. Channel name must be globally unique per client — if two components mount `useShifts`, they share the same channel name and Supabase deduplicates on the server side (safe).

## MockShift type
Already has all fields the adapter maps to: `lat`, `lng`, `dressCode`, `dressCodeItems`, `pointOfContact`, `contactPhone`, `aiMatchPct`, `companyName`, `spotsTotal`. No type changes needed in `mockFeed.ts`.
