# 365 Connect

A mobile-first event staffing marketplace that connects clients who need event workers with workers who want gigs.

## Run & Operate

- `pnpm --filter @workspace/365-connect run dev` — run the frontend (port assigned by workflow)
- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env (future phases): `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, Tailwind CSS v4, wouter (routing), Space Grotesk font
- API: Express 5 (pre-configured, not yet wired for Phase 1)
- DB: PostgreSQL + Drizzle ORM (pre-configured, not yet used for Phase 1)
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)

## Where things live

- `artifacts/365-connect/src/` — React frontend (Phase 1 complete)
  - `src/index.css` — Design system tokens (black/gold palette, Space Grotesk)
  - `src/App.tsx` — Wouter routing (splash + 5 tab routes)
  - `src/pages/SplashScreen.tsx` — Entry screen with logo + CTAs
  - `src/pages/{Home,Jobs,Messages,Notifications,Profile}Screen.tsx` — Tab placeholder screens
  - `src/components/BottomTabNav.tsx` — Persistent 5-tab bottom nav
  - `src/components/Logo.tsx` — "365 CONNECT" wordmark (gold + white)
  - `src/components/MobileContainer.tsx` — 390px mobile viewport wrapper
- `artifacts/api-server/src/` — Express API server
- `lib/db/src/schema/` — Drizzle schema (source of truth for DB)
- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth for API contracts)

## Architecture decisions

- Phase 1 is purely frontend — no API calls, no database. All data comes in future phases.
- 390px mobile container centered on desktop with pure black side gutters — simulates iPhone 14 width.
- `BottomTabNav` is rendered inside each tab page component (not in App.tsx shell) so it is naturally absent from the splash screen.
- Design system is dark-only — no light mode. `:root` and `.dark` CSS blocks share identical values.
- Space Grotesk Google Fonts `@import url(...)` must remain the absolute first line of `index.css` — PostCSS requires it before `@import 'tailwindcss'`.

## Product

**Phase 1 (complete):** Foundation, navigation, and design system.
- Splash screen with "365 CONNECT" wordmark (gold + white), tagline, Sign Up / Log In buttons
- 5-tab bottom navigation: Home, Jobs, Messages, Notifications, Profile
- Placeholder screens for each tab — all navigation fully functional

**Planned (future phases):** Worker shift browsing & applications, client shift posting & hiring, messaging, reviews, authentication.

## Design System

| Token | Value |
|---|---|
| Background | `#000000` pure black |
| Surface low | `#0E0E0E` |
| Surface mid | `#1A1A1A` |
| Primary text | `#FFFFFF` |
| Secondary text | `#9A9A9A` |
| Gold (primary) | `#FFD700` |
| Border | `#2A2A2A` |
| Tab bar bg | `#0A0A0A` |
| Border radius | `14px` |
| Font | Space Grotesk (Google Fonts) |

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Space Grotesk `@import url(...)` MUST be the first line of `index.css` — before `@import 'tailwindcss'`.
- This app is dark-only — do not introduce light mode.
- Gold `#FFD700` = interactive actions only (buttons, active states). Silver/`#2A2A2A` = structure and borders only.
- Mobile container is 390px max-width. Do not widen this for future phases.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
