# Licences and credits

What the app ships to users that someone else made, and the licence each one
comes under. The short "Credits" line in the legal page footer
(`LegalCreditsLine` in `artifacts/365-connect/src/components/LegalDocument.tsx`)
summarises the attribution-bearing items; this file is the full list. Audited
2026-10-09.

## Assets shown to users

| Asset | Source | Licence | Obligation | Status |
| --- | --- | --- | --- | --- |
| Space Grotesk typeface | Florian Karsten, served from Google Fonts | SIL Open Font License 1.1 | None for web use; attribution is customary | Credited in the footer |
| Icons | [Lucide](https://lucide.dev) (`lucide-react`) | ISC | Keep the copyright notice in the bundle (the library does this) | Credited in the footer |
| Default shift cover photos (`COVER_FALLBACKS` in `src/lib/supabase.ts`) | Unsplash, all 11 URLs on `images.unsplash.com` | [Unsplash License](https://unsplash.com/license): free for commercial use, no attribution required, no compiling into a competing stock service | None | Credited anyway in the footer |
| Map tiles (Leaflet fallback map) | CARTO "Voyager" basemap over OpenStreetMap data | CARTO basemaps are free for non-commercial and low-volume use with attribution; OSM data is ODbL | "© OpenStreetMap © CARTO" must stay visible on the map | Shown on the map (`TILE_ATTR` in `LeafletMap.tsx`) and in the footer. **Owner:** confirm volume stays within CARTO's free tier or move to a paid plan |
| Map (Apple engine) | Apple MapKit JS | Apple Developer Program licence | Apple's own attribution is rendered by MapKit | Requires the owner's Apple developer account and keys |
| Address search | Nominatim (OpenStreetMap Foundation) | ODbL data; [usage policy](https://operations.osmfoundation.org/policies/nominatim/) | Low volume (max 1 request/s), a valid User-Agent or Referer, attribution | Attribution in the footer. **Owner:** the policy forbids heavy use; move to a commercial geocoder if volume grows |
| Avatars for demo accounts | DiceBear (seed script only, not mounted) | DiceBear API: free; "avataaars" style CC BY 4.0 | Attribution if shipped | Not shipped to users |

## Code dependencies bundled into the web app

All permissive; no copyleft in the client bundle. Notice files ship with the
build where the licence asks for it.

| Package | Licence |
| --- | --- |
| react, react-dom | MIT |
| wouter | Unlicense (public domain) |
| @tanstack/react-query | MIT |
| framer-motion | MIT |
| tailwindcss | MIT |
| lucide-react | ISC |
| leaflet | BSD-2-Clause |
| react-leaflet | Hippocratic License 2.1 (see note) |
| react-easy-crop | MIT |
| @supabase/supabase-js and sub-packages | MIT |
| @capacitor/* | MIT |

**Note on react-leaflet.** The Hippocratic License is a permissive MIT-style
licence with an added ethical-use condition (no use that violates the UN
Universal Declaration of Human Rights). It is compatible with this app's use
but is not OSI-approved; if the owner's counsel objects, the Leaflet wrapper
is small enough to replace with direct `leaflet` calls.

## Code dependencies on the server

| Package | Licence |
| --- | --- |
| express, cors, cookie-parser, jose, pino, pino-http, zod, http-proxy-middleware | MIT |
| @anthropic-ai/sdk | MIT |
| @supabase/supabase-js | MIT |
| drizzle-orm | Apache-2.0 |
| web-push | MPL-2.0 (file-level copyleft; unmodified, so no obligations beyond keeping its notice) |
| google-auth-library, @google-cloud/storage | Apache-2.0 (legacy object-storage path, not used by the app; see docs/third-parties.md) |

## What is ours

Everything under `artifacts/` and `lib/` that is not a dependency, the logo
and app icons, and the legal documents. Users' photos, posts and messages
remain theirs under the licence in the Terms of Service (Section on user
content).
