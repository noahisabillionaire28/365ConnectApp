# Terms of Service and Privacy Policy

Where the two legal documents live, what they cover, the placeholders that
must be filled before launch, and how the acceptance flow works.

> These documents were drafted in-house as a starting point modelled on
> gig-staffing marketplace terms. **Have a licensed attorney (California
> employment and consumer law) review both before launch**, in particular the
> independent-contractor language, the arbitration / class-waiver section, the
> liability cap, and the CCPA disclosures.

## Where things are

| What | Path |
| --- | --- |
| Shared settings (entity, law, venue, contact, versions) | `artifacts/365-connect/src/legal/config.ts` |
| Terms of Service (structured prose) | `artifacts/365-connect/src/legal/terms.ts` |
| Privacy Policy (structured prose) | `artifacts/365-connect/src/legal/privacy.ts` |
| Public pages `/terms`, `/privacy` (`/legal` → `/terms`) | `artifacts/365-connect/src/pages/LegalScreen.tsx` |
| Document renderer + in-app sheet | `artifacts/365-connect/src/components/LegalDocument.tsx` |
| Acceptance gate (full-screen, non-dismissable) | `artifacts/365-connect/src/components/LegalGate.tsx` |
| React-query hooks (`['legal', …]`) | `artifacts/365-connect/src/hooks/useLegal.ts` |
| Server versions (authoritative) | `artifacts/api-server/src/lib/legal.ts` |
| API routes `/legal/versions`, `/legal/status`, `/legal/accept` | `artifacts/api-server/src/routes/legal.ts` |
| `requireLegal` middleware (428 on un-accepted writes) | `artifacts/api-server/src/middleware/legal.ts` |
| Migration | `supabase/migrations/0036_legal_acceptances.sql` (applied) |

## What the documents cover

**Terms of Service** (30 sections): eligibility (18+, authority to bind a
business); account security; the platform-only relationship (no employment,
agency, partnership or joint venture; we are not a party to any engagement and
do not supervise work); an Independent Contractor Acknowledgment that both
workers and posters accept; poster obligations (accurate shifts, minimum wage /
overtime / tips / breaks, safe worksite, insurance, permits, non-discrimination,
timely timesheet approval and payment); worker obligations (accuracy, licences,
attendance, conduct, taxes); bookings, cancellations, no-shows, call-outs and
swaps; clock-in location data and timesheets (approval, adjustments, disputes;
we facilitate but do not adjudicate); payments (recorded outside the app or via
Stripe; not a payment agent; fees with notice; chargebacks; taxes); ratings;
user content licence and prohibited content; prohibited conduct; off-platform
dealings at the parties' own risk; communications consent (push and email, no
SMS); intellectual property; third-party services; beta features and
automated matching (informational only); DMCA; suspension and termination;
AS-IS disclaimers (no guarantee of shifts, workers, payment, safety, identity,
background checks); assumption of risk; limitation of liability (greater of
$100 or fees paid to us in the prior 12 months; no indirect damages; statutory
carve-outs); indemnification (including misclassification, wage and worksite
injury claims arising from a poster's engagement of workers); release with the
California Civil Code § 1542 waiver; dispute resolution (30-day informal notice,
binding individual arbitration under the AAA Consumer Rules with JAMS fallback,
30-day email opt-out, conspicuous class-action and jury waiver, small-claims
carve-out); California law and Los Angeles County venue; changes; general
terms; Apple App Store terms; contact.

**Privacy Policy** (18 sections): what we collect (account, profile,
role-specific details, content, payment records with card details held only
by Stripe, communications), what is collected automatically (precise location
at clock-in/out, approximate location for distance, device and push tokens,
usage and logs, cookies and local storage, timesheet events), information from
other people; how it is used; the automated-matching disclosure (rules plus
non-identifying signals sent to a processor at Anthropic; no solely automated
decisions with legal effect; people decide bookings); legal bases; sharing
with the counterparty on a shift and with other users; processors (Supabase,
Vercel, Resend, Stripe, Anthropic, Apple, Google Fonts, OpenStreetMap /
CARTO); legal requests and business transfers; retention; security; choices
(notifications, location permission, delete account in-app, export on
request); California rights (CCPA/CPRA categories, know / delete / correct /
portability, no sale or sharing, non-discrimination, how to exercise,
authorized agents); other US state rights with appeal; children (18+, COPPA);
Do Not Track / GPC; international users; changes; contact.

## TODO placeholders to fill before launch

All three live in `artifacts/365-connect/src/legal/config.ts` and are
rendered verbatim into the documents today:

| Field | Current value | Replace with |
| --- | --- | --- |
| `entityName` / `entityNote` | `365 Connect` + a TODO note | The registered legal entity (e.g. "365 Connect LLC") once formed; then delete `entityNote` and the sentences that print it (the last section of each document). |
| `mailingAddress` | `TODO: mailing address for legal notices` | A street or registered-agent address that can receive dispute notices, DMCA notices and arbitration opt-outs. |
| `contactEmail` / `contactEmailNote` | `legal@365connect.app` | A monitored mailbox. The Terms promise a reply path for dispute notices, arbitration opt-outs, privacy requests and California requests, so mail to it must be read. |

Also worth confirming: `governingLaw` / `venueCounty` (California / Los
Angeles County) match where the business is actually based, and the
`support@365connect.com` address on the suspended-account screen matches the
legal mailbox's domain.

## How versions and re-acceptance work

- Each document has a version string, currently the effective date
  (`2026-10-06`). The server copy in `artifacts/api-server/src/lib/legal.ts`
  is authoritative; the app fetches `GET /api/legal/versions` and falls back
  to its own `LEGAL.termsVersion` / `LEGAL.privacyVersion` only if the API is
  unreachable.
- Every acceptance is a row in `legal_acceptances` (document, version,
  timestamp, IP, user agent). The latest accepted version per document is also
  written to `users.terms_version` / `users.privacy_version`, which is what
  the server gate reads.
- **To force everyone to accept again** after a material change: edit the
  prose, bump the version string in **both** `api-server/src/lib/legal.ts`
  and `365-connect/src/legal/config.ts` (and make sure the document's
  `effectiveDate` follows), deploy. Each user sees the gate once ("We've
  updated our Terms"); accepting records a new row and clears the gate.
- Bump only the document that changed; the gate asks for both documents in one
  tap either way.

## Enforcement

- **Sign-up** cannot be submitted until the checkbox is ticked; the acceptance
  is recorded right after the profile row is created.
- **LegalGate** (in the app shell) asks any signed-in user whose status is
  missing or outdated, which also covers OAuth / first-login users who never
  saw the sign-up form. It stays off the auth screens and the document pages.
- **Server**: `requireLegal` returns `428 { code: 'legal_required' }` for any
  signed-in POST / PATCH / PUT / DELETE except `/auth/*`, `/legal/*`,
  `/push/*`, `POST /users`, and `/users/me` (so onboarding can finish and a
  user who declines can still delete their account). Reads are never blocked
  so the gate can render. The app's API client turns a 428 into a
  `legal:required` window event that makes the gate re-check, so a stale tab
  re-prompts instead of failing silently.
- `GET /legal/status` and `POST /legal/accept` use `requireSession`, so a
  suspended account can still read and accept (its other writes remain
  blocked by `requireAuth`).

## Arbitration opt-out mailbox

Section 25 of the Terms gives users 30 days from first acceptance to opt out
of arbitration by emailing the legal mailbox with the subject "Arbitration
opt-out". Keep a simple log of those emails (account email, date received)
alongside the `legal_acceptances` rows: `accepted_at` of the user's first
`terms` row is the start of their 30-day window. The same mailbox receives
pre-arbitration dispute notices (30-day informal period), DMCA notices and
counter-notices, and privacy / CCPA requests, which have statutory response
deadlines (45 days for California).
