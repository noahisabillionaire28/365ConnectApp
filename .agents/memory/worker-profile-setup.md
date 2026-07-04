---
name: Worker profile setup flow
description: Decisions and gotchas for the 6-step worker profile setup and public worker profile page in 365 Connect.
---

## Rule
Profile setup flow lives at `/profile-setup` (ProfileSetupScreen.tsx). On "Complete Profile", navigate to `/worker/${username}` — not `/home` — so the worker immediately sees their public profile.

**Why:** The UX intent is: set up profile → land on your own public page. Sending to /home breaks that loop and makes it feel like the setup went nowhere.

**How to apply:** Any future profile-edit flow should also redirect back to `/worker/:username` on save.

## Mock data pattern
WorkerProfileScreen reads `params.username` and looks it up in `MOCK_PROFILES` (a Record keyed by username). Unknown usernames render a "Profile not found" empty state. When real API is wired, replace the lookup with a fetch call but keep the same not-found guard.

## Onboarding → profile setup
OnboardingScreen's Get Started and Skip both navigate to `/profile-setup`. Previously they went to `/home`. The role selection ("hiring" vs "working") is not persisted yet — the profile setup flow is worker-only for now; hiring flow to be added when role state is persisted.

## Apostrophe in single-quoted JSX strings
Any string literal containing an apostrophe (e.g. "New Year's") must use double quotes or a template literal — single-quoted JSX strings will cause a Babel parse error at build time.
