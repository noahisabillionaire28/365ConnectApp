---
name: Location resolution fallback chain
description: How 365 Connect resolves "my current location" for distance/match-score/geofencing features, and why it never blocks the UI.
---

Viewer location is resolved in priority order, never blocking or blanking the UI:
1. Stored `users.lat/lng` in the database (fastest, no permission prompt).
2. Browser geolocation API — result is persisted back to the user's profile for next time.
3. A static city-center fallback constant, used if geolocation is denied, unavailable, or the DB columns don't exist yet.

**Why:** Distance-dependent features (feed filtering, match score, map, clock-in geofencing) must never crash or show a blank screen just because a user hasn't granted geolocation permission or a schema migration hasn't landed yet.

**How to apply:** Any new feature needing "the current user's location" should reuse the existing resolver hook rather than querying lat/lng directly — it already encodes this fallback chain and the schema-missing (`42703`) handling in one place.
