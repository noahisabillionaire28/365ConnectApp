# Third-party services

Every service outside our own code that receives data at runtime, audited on
2026-10-09 from the dependencies that are actually imported and from every
external URL the app or API fetches, embeds or links to. The processor list in
`artifacts/365-connect/src/legal/privacy.ts` (Section 7) and the Cookie &
Local Storage Policy mirror this table; update all three together.

## Services that receive personal data (processors)

| Service | Where in code | Purpose | Data shared |
| --- | --- | --- | --- |
| Supabase (US) | `365-connect/src/lib/supabase.ts`, `api-server/src/lib/supabaseAdmin.ts`, `routes/storage.ts` | Postgres database, auth (email/password, Google and Apple sign-in), file storage (avatars, post photos, chat media, uploads), realtime | Everything the app stores: accounts, profiles, content, messages, timesheets, clock-in coordinates, payment records, legal acceptances |
| Vercel | deployment (`365-connect-app.vercel.app`) | Hosts the web app and the API | Request logs (IP, user agent, URL), everything passing through the API |
| Resend | `api-server/src/lib/email.ts` | Transactional email (notifications, unsubscribe links) | Recipient email address, subject and body of the notification |
| Stripe | `api-server/src/routes/payments.ts` (Checkout Sessions API) | Payment processing and Pro subscription billing, where enabled | Account id, email, amount; card details are entered on Stripe's page and never reach us |
| Anthropic | `api-server/src/lib/matching.ts` | Ranks candidate workers for a shift ("match insights") | Shift title, role, event type, time, requirements, description; per candidate a random account id, skills, certifications, rating and review count, distance in miles, shifts worked, shifts with this poster, no-shows, on-time rate, availability that day. No names, usernames, bios, photos, messages or coordinates. Only used when `ANTHROPIC_API_KEY` is set; rules otherwise |
| Apple (APNs) | `api-server/src/lib/apns.ts`, `@capacitor/push-notifications` | Push notifications to the iOS app and Safari | Device token, notification title/body/URL, badge count |
| Apple (MapKit JS) | `365-connect/src/lib/mapkit.ts`, `components/AppleMap.tsx` | Map rendering when the Apple engine is active (geocoding is done by Nominatim, below) | Map areas requested, IP address |
| Google (push) | `api-server/src/lib/push.ts` (`web-push`) | Delivers web push to Chrome and Edge | Push endpoint and an encrypted payload the service cannot read |
| Mozilla (push) | `api-server/src/lib/push.ts` (`web-push`) | Delivers web push to Firefox | Same as above |
| Google Fonts | `365-connect/index.html` | Serves Space Grotesk | IP address and user agent on font load |
| CARTO / OpenStreetMap | `365-connect/src/components/LeafletMap.tsx` | Map tiles (Voyager style) when the Leaflet fallback map is used | Tile areas requested, IP address |
| Nominatim (OSM Foundation) | `components/WizardShared.tsx`, `lib/geocode.ts`, `pages/PostShiftStep2Screen.tsx` | Address search and geocoding for shift venues and profile locations | The typed address text, IP address. Subject to the Nominatim usage policy (low volume, attribution) |
| Unsplash | `365-connect/src/lib/supabase.ts` (`COVER_FALLBACKS`) | Default cover photo for a shift with no photo | Image request, IP address |
| Websites linked in chat | `api-server/src/routes/link-preview.ts` | Title/description/image preview for a pasted link | Fetched once by our server (not the user's device), 256 KB cap, private ranges blocked; the site sees our server's address |

## Services the user opens themselves (no data sent until they tap)

| Service | Where in code | Purpose |
| --- | --- | --- |
| Google Calendar | `365-connect/src/lib/calendar.ts` | "Add to calendar" link; .ics download is the alternative |
| Apple Maps, Google Maps, Waze | `pages/ShiftDetailScreen.tsx`, `pages/ChatScreen.tsx` | Directions to a worksite or a shared location |

## Present in code but not in use

| What | Where | Status |
| --- | --- | --- |
| Google Cloud Storage (`@google-cloud/storage`) | `api-server/src/lib/objectStorage.ts`, `routes/storage.ts` (`/storage/objects/*`) | Legacy object-storage routes from the original hosting environment. The app only calls `/storage/sign-upload`, which uses Supabase Storage. Safe to delete together with the `PUBLIC_OBJECT_SEARCH_PATHS` / `PRIVATE_OBJECT_DIR` env vars |
| DiceBear avatars | `api-server/src/routes/seed.ts` | Demo-account avatars for the seed script, which is not mounted and refuses to run in production |
| `@vis.gl/react-google-maps` | `365-connect/package.json` | Declared but never imported; remove from dependencies at the next cleanup |

## No analytics, advertising or tracking

The app loads no analytics, advertising, session-replay or crash-reporting SDKs
and sets no third-party cookies. The only browser storage is listed in the
Cookie & Local Storage Policy.
