---
name: AI match score formula
description: The 40/30/20/10 weighting used for the worker/shift AI Match Score in 365 Connect, and the gotcha with distance input.
---

The AI Match Score (365 Connect, shown on shift detail for workers only) is a weighted sum out of 100:
- 40 pts — job-type match (worker's primary or secondary job types intersect the shift's job type(s))
- 30 pts — availability match (day-of-week of the shift vs. worker's `availability[dayOfWeek]` boolean)
- 20 pts — `(worker.rating / 5) * 20`
- 10 pts — distance falloff, full marks ≤5mi, linearly tapering to 0 at ≥20mi

**Why:** Day-of-week can't be derived from a pre-formatted display string like "9:00 PM" — the underlying data model needs a raw ISO timestamp field alongside any human-formatted fields whenever a formula needs to derive date parts.

**How to apply:** When computing this score for a specific shift, always pass the *viewer's real resolved coordinates* (see location-fallback-chain.md) into the distance calculation — not a hardcoded default — or the distance component (and thus the whole score) will be wrong for any user not located near the fallback point.
