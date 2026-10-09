/**
 * Cookie & Local Storage Policy — informational (not part of the acceptance
 * set). Rendered at /cookies and linked from the Privacy Policy and the
 * one-time storage notice. Keep it accurate: every entry below corresponds to
 * real storage the app writes (see docs/third-parties.md for the audit).
 */
import { LEGAL, type LegalDocument } from './config';

const C = LEGAL.entityName;
const EMAIL = LEGAL.contactEmail;

export const COOKIES: LegalDocument = {
  title: 'Cookie & Local Storage Policy',
  shortTitle: 'Cookies & Storage',
  effectiveDate: LEGAL.cookiesVersion,
  intro: [
    `This policy explains what 365 Connect stores on your device and which other services learn your IP address when the app loads. The short version: we use essential storage only. There are no advertising cookies, no analytics or tracking cookies, and no third-party tracking pixels, on the web or in the iOS app.`,
    `Because everything we store is needed to run the app you asked for, the law does not require us to ask for consent, and we do not show a cookie banner. We show a one-time notice instead, so you know what to expect.`,
  ],
  sections: [
    {
      id: 'what-we-store',
      heading: '1. What we store on your device',
      paragraphs: [
        `${C} itself sets no cookies. Everything below lives in your browser's local storage or session storage (or the equivalent inside the iOS app), is readable only by 365 Connect, and is never sent to advertisers.`,
      ],
      bullets: [
        `Sign-in session (local storage, set by our authentication provider Supabase): the token that keeps you signed in between visits. Removed when you sign out; expires on its own otherwise.`,
        `Data cache (local storage, "365connect:query-cache"): a copy of the shifts, profiles and messages you last looked at, so the app opens instantly and still shows something when the network is slow. Entries older than 24 hours are dropped, the cache is cleared when you sign out, and a new version of the app discards caches written by an older one.`,
        `Small preferences: the tab or filter you last used, cards you dismissed (such as the install hint, the rating reminder and the storage notice), the step you had reached in profile setup, an unsaved shift draft or message you were writing, your preferred map engine, and, for administrators, which role they are previewing. These are plain settings with no tracking value.`,
        `Push notification registration (web): if you turn on push notifications, your browser creates a subscription that we store on our server so we can deliver alerts; the browser keeps its half locally. Turning push off or signing out removes it.`,
      ],
    },
    {
      id: 'no-tracking',
      heading: '2. What we do not do',
      paragraphs: [
        `We do not use advertising cookies, retargeting, cross-site tracking, analytics SDKs, session-replay tools, fingerprinting or social-media pixels. We do not sell or share browsing data. Because nothing tracks you, a Do Not Track or Global Privacy Control signal changes nothing: the app already behaves as if it were on.`,
      ],
    },
    {
      id: 'third-parties',
      heading: '3. Services that see your IP address',
      paragraphs: [
        `Loading some parts of the app means your browser or phone connects directly to another company's servers, which therefore see your IP address and basic request details in the ordinary way any web request does. None of them set cookies for 365 Connect except where noted.`,
      ],
      bullets: [
        `Google Fonts (fonts.googleapis.com, fonts.gstatic.com): the Space Grotesk typeface. Google receives the font request and your IP address; it does not set cookies for font requests.`,
        `Map tiles (CARTO, drawing OpenStreetMap data) and, where configured, Apple Maps (MapKit JS): the map images and place labels for the areas you look at. The tile provider sees the map areas requested and your IP address.`,
        `Nominatim (OpenStreetMap Foundation): when a poster types a venue address, the text is sent to Nominatim to turn it into coordinates. Nominatim sees the address text and your IP address.`,
        `Unsplash (images.unsplash.com): the default cover photo shown on a shift that has no photo of its own. Unsplash sees the image request and your IP address.`,
        `Supabase and Vercel: our database, authentication, file storage and hosting. These are the servers the app talks to for everything; they keep standard server logs, as described in the Privacy Policy.`,
        `Stripe (only when card payments are enabled and you choose to pay by card): the checkout page is hosted by Stripe, and Stripe sets its own cookies on that page for fraud prevention and to complete the payment, under Stripe's privacy policy.`,
        `Links you choose to open (Apple Maps, Google Maps, Waze for directions; Google Calendar for a calendar export) take you to those services, which apply their own policies.`,
      ],
      links: [{ label: 'Service providers in the Privacy Policy', page: 'privacy' }],
    },
    {
      id: 'clearing',
      heading: '4. How to clear it',
      paragraphs: [
        `Sign out (Settings → Log Out): removes your sign-in session and the data cache. Dismissed-card preferences stay so you are not shown the same hints again; they contain no personal information.`,
        `Browser settings: clearing site data for 365 Connect in your browser removes everything in Section 1, including preferences. In the iOS app, deleting the app removes all of it.`,
        `Turning off push: Settings → Notifications → Push notifications off removes the push subscription for that device.`,
      ],
    },
    {
      id: 'changes',
      heading: '5. Changes and contact',
      paragraphs: [
        `If we ever add storage that is not essential (for example analytics), we will update this policy, ask for your consent first where the law requires it, and honor opt-out signals. The effective date at the top tells you which version you are reading. Questions: ${EMAIL}.`,
      ],
    },
  ],
};
