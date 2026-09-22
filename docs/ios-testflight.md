# 365 Connect on iOS (TestFlight)

The iOS app is the same React web app wrapped in a native shell (Capacitor).
The web deployment on Vercel is untouched; the native shell is an extra
build target that lives in `artifacts/365-connect/ios`.

## What is already done in the repo

- `capacitor.config.ts` — app name, bundle id `com.connect365.app`, splash, push.
- `ios/App` — the Xcode project (generated, committed).
- `ios/App/App/Info.plist` — URL scheme `connect365://`, background push,
  permission strings for location, camera, photos and microphone.
- `ios/App/App/App.entitlements` — Apple push entitlement.
- `ios/App/ci_scripts/ci_post_clone.sh` — Xcode Cloud builds the web app and
  copies it into the iOS project before every build. No Mac needed.
- Native behaviour in the app: status bar, splash, deep links, Apple push
  (`src/lib/native.ts`, `src/components/NativeBridge.tsx`, `src/hooks/usePush.ts`).
- API: Apple push sender (`api-server/src/lib/apns.ts`), native device tokens
  stored next to web subscriptions (migration 0024).
- Pro subscription is hidden on iOS (Apple requires in-app purchase for it).

## One-time steps only the account owner can do

1. **Enroll in the Apple Developer Program** (developer.apple.com, $99/yr).
   Approval can take 1–2 days.
2. **App Store Connect → Apps → New App**: platform iOS, name "365 Connect",
   bundle id `com.connect365.app` (create the identifier in
   Certificates, Identifiers & Profiles if prompted; enable the
   *Push Notifications* capability on it).
3. **Push key**: Certificates, Identifiers & Profiles → Keys → new key with
   *Apple Push Notifications service (APNs)* enabled. Download the `.p8`
   file once and note the Key ID and your Team ID.
4. **Vercel (365-connect-api project)**: add environment variables
   `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_KEY` (the whole `.p8` file contents),
   `APNS_BUNDLE_ID=com.connect365.app`, then redeploy.
5. **Supabase → Authentication → URL Configuration**: add
   `connect365://auth/callback` to the redirect allow-list (needed for magic
   links / social sign-in inside the app; email + password works without it).
6. **Xcode Cloud** (App Store Connect → your app → Xcode Cloud → Get Started):
   connect the GitHub repo, pick the `main` branch, product "App", scheme
   "App", action *Archive* with *TestFlight (Internal Testing)* as the
   post-action. Xcode Cloud signs the build automatically. Every push to
   `main` then produces a new TestFlight build.
7. **TestFlight → Internal Testing**: add testers by Apple ID. They get an
   email with the install link. No review is needed for internal testers.

## Building locally instead (needs a Mac)

```sh
cd artifacts/365-connect
PORT=5173 BASE_PATH=/ pnpm exec vite build
pnpm exec cap sync ios
pnpm exec cap open ios     # opens Xcode → Product → Archive → Distribute
```

## Notes

- `APNS_SANDBOX=1` on the API switches to Apple's sandbox gateway, which is
  only for builds installed directly from Xcode. TestFlight and App Store
  builds use production (the default).
- To change the bundle id, edit `capacitor.config.ts` and
  `ios/App/App.xcodeproj/project.pbxproj` (two `PRODUCT_BUNDLE_IDENTIFIER`
  lines) and `Info.plist`'s URL name.
