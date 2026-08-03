---
name: API migration patterns
description: Key patterns and gotchas from migrating all Supabase data calls to the api-server REST layer
---

## Hook return type index signatures break React rendering

If a hook type uses `[key: string]: unknown` in any intermediate type that gets spread into the exported type, TypeScript widens all property accesses to `unknown`. This causes "Type 'unknown' is not assignable to type 'ReactNode'" in JSX. **Fix:** remove index signatures; list all fields explicitly.

**Why:** TypeScript's excess property checking treats `[key: string]: unknown` as an override for all properties when accessed through that type.

**How to apply:** Any time you see ReactNode type errors on explicit fields from a hook type, check whether an intermediate `type RawX = { ..., [key: string]: unknown }` is being spread into the exported type.

## React Query `status` shadowing

`useQuery` returns `{ status: 'pending' | 'error' | 'success', data, ... }`. If you destructure `{ status }` from a hook that directly returns the React Query result, you get the query lifecycle status, NOT the `data.status` from the server. Always expose data explicitly: `return { status: query.data?.status ?? null, isLoading: query.isLoading }`.

**How to apply:** Any hook wrapping `useQuery` that returns a domain `status` value must explicitly map it from `query.data`, not return the query object directly.

## camelCase alias pattern for hooks

Every hook that wraps a snake_case DB row should add camelCase aliases in a `toXxx()` mapping function before returning. Screens expect camelCase; the API returns snake_case. Alias list that was needed: `applicationId`, `shiftId`, `shiftTitle`, `companyName`, `startTime`, `endTime`, `payRate`, `payPeriod`, `jobType`, `coverImage`, `workerId`, `photoUrl`, `matchScore`, `jobTypes`, `primaryJobType`, `applicantCount`, `startTimeISO`, `clockInISO`, `breakMinutes`, `totalPay`, `alreadyCompleted`, `resumed`, `availableToday`, `isPro`, `primaryJobType`.

## `createShiftRequest` return type

Changed from `boolean` to `{ ok: boolean; message?: string }` — screens check `result.ok` and `result.message`. The hook's internal `sendRequest` helper still returns `boolean` (calls `.ok` internally).

## useTimeEntry.startOrResume enriched return

`startOrResume` returns `TimeEntryRow & { alreadyCompleted, resumed, clockInISO, breakMinutes, totalPay }`. It first checks for an existing entry via GET; if found and `clock_out` is set → `alreadyCompleted: true`; if found but active → `resumed: true`. Accepts optional `(shiftId?, userId?)` args (ignored — come from hook closure).

## useExistingReview 3-arg signature

ReviewScreen calls `useExistingReview(shiftId, reviewerId, revieweeId)` and expects `{ existing, isLoading }` (not `existingReview`). The standalone `submitReview` export accepts both camelCase and snake_case keys and returns `{ error, duplicate }`.
