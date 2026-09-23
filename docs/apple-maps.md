# Apple Maps in 365 Connect

Every map in the app (shift location, Jobs map, post-shift preview) goes through
one component, `AppMap`. It renders the real Apple Maps (MapKit JS) when the API
server has an Apple Maps key, and an Apple-styled dark fallback map otherwise.
The layout around the map (address bar with ✕, logo pin, "Hide Map", distance
and drive-time footer) is the same either way.

## What is already done in the repo

- `artifacts/api-server/src/lib/appleMaps.ts` signs MapKit JS tokens with the key
  (ES256, 30-minute expiry, optional origin pinning).
- `GET /api/maps/token` hands a token to signed-in users, or `404 {configured:false}`.
- `artifacts/365-connect/src/lib/mapkit.ts` asks that endpoint once per tab, loads
  MapKit JS from Apple's CDN when configured, and refreshes tokens automatically.
- `components/AppleMap.tsx` draws the Apple map in light mode with the app's own
  pins; `components/LeafletMap.tsx` is the fallback with the same pins.
- `/api/healthz` reports `"maps": "apple"` or `"maps": "fallback"`.

## One-time steps only the account owner can do

These need the Apple Developer Program membership already on the to-do list for
TestFlight. Once enrolled:

1. In the Apple Developer portal go to **Certificates, Identifiers & Profiles →
   Identifiers**, add a **Maps ID** (for example `maps.com.connect365.app`).
2. Go to **Keys**, add a key, tick **Maps**, pick that Maps ID, and download the
   `.p8` file. Note the **Key ID** shown on the page and your **Team ID** (top
   right of the portal).
3. In Vercel, on the **365-connect-api** project, add these environment
   variables and redeploy:

   | Variable | Value |
   | --- | --- |
   | `APPLE_MAPS_KEY_ID` | the 10-character Key ID |
   | `APPLE_MAPS_KEY` | the whole `.p8` file contents |
   | `APPLE_TEAM_ID` | your Team ID (optional if `APNS_TEAM_ID` is already set) |
   | `APPLE_MAPS_ORIGIN` | optional: `https://365-connect-app.vercel.app,capacitor://localhost` |

4. Open `https://365-connect-api.vercel.app/api/healthz` and confirm
   `"maps": "apple"`. Open any shift in the app: the map is now Apple Maps.

No frontend change or redeploy is needed. Tabs that were already open switch
within an hour or on the next new tab.

## Notes

- Apple gives MapKit JS a free daily allowance (250,000 map views and 25,000
  service calls per day at the time of writing), far above the app's traffic.
- The fallback map uses CARTO's free light (Voyager) basemap on OpenStreetMap data; its
  credit line is drawn in the map corner as their terms require. Apple's engine
  draws its own legal link.
- Tokens never expose the private key; the browser only ever sees a 30-minute
  signed token minted by the API for signed-in users.
