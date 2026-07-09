---
name: Playwright e2e setup
description: Auth strategy, browser deps, and step-ordering for the 365 Connect e2e suite.
---

# Playwright e2e setup

## Auth strategy — why magic-link token exchange
Navigating to the Supabase-issued `action_link` in a browser stores the session under the public Replit preview domain, not `localhost:PORT`. Because tests run against `localhost`, storageState from the redirect is scoped to the wrong origin and tests see a logged-out state.

**Fix:** Exchange the magic-link `token_hash` directly via `POST /auth/v1/verify` (anon key), inject the returned `access_token`/`refresh_token` into `localStorage` for `http://localhost:PORT` using `page.evaluate()`, then save storageState. This bypasses SEED_TEST_PASSWORD entirely (safe even when the secret is too short for Supabase's 6-char minimum).

## Chromium system deps required in this Nix environment
glib, nss, nspr, dbus, atk, cups, at-spi2-atk, at-spi2-core, libdrm, mesa, expat, alsa-lib, pango, cairo, gtk3, gdk-pixbuf, xorg.libX11 + common xorg libs, libxkbcommon, udev, libgbm.

**Why:** Playwright downloads its own Chromium binary but it links against system glibc/glib. Without these Nix packages the binary fails on `libglib-2.0.so.0: cannot open shared object file`.

## Post-shift wizard step ordering (current)
Step 1: job type + shift title → Step 2: location → Step 3: date/time → Step 4: pay rate → Step 5: review/post → navigates to `/shift/:id` on success.
