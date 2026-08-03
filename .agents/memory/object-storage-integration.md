---
name: Object Storage integration
description: Replit Object Storage setup, presigned-URL upload flow, and known limitations after Task #23.
---

# Object Storage integration

## The rule
Use `src/lib/storage.ts` (frontend) for all file uploads. Never import Supabase storage helpers.

**Why:** Supabase Storage has been fully removed. All uploads now go through Replit Object Storage via a two-step presigned-URL flow.

## How to apply

### Upload flow (frontend)
1. `POST /api/storage/uploads/request-url` with `{ name, size, contentType }` → `{ uploadURL, objectPath }`
2. `PUT <uploadURL>` with the file bytes (direct to GCS, no backend traffic)
3. Store `objectPath` or `/api/storage/objects/...` URL in the DB column

Helper functions in `artifacts/365-connect/src/lib/storage.ts`:
- `uploadAvatar(userId, file)` → serving URL
- `uploadPostPhoto(userId, file)` → serving URL
- `uploadChatImage/Video/Voice(conversationId, file, userId?)` → serving URL
- `getSignedChatMediaUrl(path)` → shim; new URLs are served directly, legacy Supabase paths return null

### Server (api-server)
- Route: `artifacts/api-server/src/routes/storage.ts`
- `POST /api/storage/uploads/request-url` — requires `req.userId` (Clerk auth)
- `GET /api/storage/objects/*path` — serves private objects
- `GET /api/storage/public-objects/*filePath` — serves public objects
- **Do NOT import zod in this route** — esbuild cannot bundle it; use manual type assertions instead

### Serving files
Stored URLs are `/api/storage/objects/uploads/<uuid>`. The server pipes GCS bytes through.

## Known limitations
- Reviews API (`GET /api/reviews/:userId`) returns `reviewer_username` but NOT shift title or shift start_time. `WorkerProfileScreen` shows `'Unnamed Shift'` and `'—'` for all past shifts. Fix: JOIN `shifts` in the reviews query.
- Admin login (`AdminLogin.tsx`) still shows an email/password form — it now redirects to `/sign-in` instead of authenticating directly. Consider updating the admin login UX to reflect the Clerk flow.
