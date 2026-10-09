/**
 * Privacy Policy — structured so the same text renders on /privacy, inside
 * the sign-up and acceptance sheets, and in print. Edit the prose here; bump
 * LEGAL.privacyVersion (and the server copy) when the change is material.
 */
import { LEGAL, type LegalDocument } from './config';

const C = LEGAL.entityName;
const EMAIL = LEGAL.contactEmail;

export const PRIVACY: LegalDocument = {
  title: 'Privacy Policy',
  shortTitle: 'Privacy',
  effectiveDate: LEGAL.privacyVersion,
  intro: [
    `This Privacy Policy explains how ${C} ("${C}," "we," "us," or "our") collects, uses, shares, and protects information about you when you use the 365 Connect website, mobile and web applications, and related services (together, the "Platform"). It also explains the choices you have, including rights under California and other U.S. state privacy laws.`,
    `365 Connect is a marketplace where people who perform event-staffing work ("Workers") find shifts posted by venues, hosts, and planners ("Clients") and by staffing agencies ("Staffers"; Clients and Staffers together are "Posters"). Much of the information described here is shared with the other side of a booking so that a shift can be staffed, worked, confirmed, and paid. By using the Platform you agree to this Policy and to our Terms of Service.`,
  ],
  sections: [
    {
      id: 'collect',
      heading: '1. Information we collect',
      paragraphs: [
        `We collect information you give us, information generated when you use the Platform, and a limited amount of information from third parties.`,
        `Information you provide:`,
      ],
      bullets: [
        `Account information: email address, password (stored only as a hash by our authentication provider), and, if you sign in with Google or Apple, the name, email, and profile picture those services share with us.`,
        `Profile information: username, display or business name, photo, bio, home location or service area, skills, event types, certifications and licences, hourly rate, availability, and, for Posters, company or venue details, points of contact, and phone numbers you choose to add to a shift.`,
        `Role-specific details: for Workers, work history on the Platform, ratings, and arrival records; for Posters, shift postings, rosters, templates, and saved workers; for Staffers, the Workers on your roster and assignments you make.`,
        `Content: posts, stories, comments, likes, follows, hashtags, messages and chat attachments (images, video, audio, and PDF files), shift descriptions, reviews, timesheet notes, dispute descriptions, and anything else you upload or send.`,
        `Payment records: amounts owed, recorded as paid, or paid through the Platform, payout history, and subscription status. When a payment is processed through Stripe, your card or bank details are collected directly by Stripe; we receive only a token, the last four digits, the card brand, and the transaction status. We never store full card numbers.`,
        `Communications with us: support requests, legal notices, dispute correspondence, and survey responses.`,
      ],
    },
    {
      id: 'collect-automatic',
      heading: '2. Information collected automatically',
      paragraphs: [
        `When you use the Platform we and our service providers automatically collect:`,
      ],
      bullets: [
        `Precise location at clock-in and clock-out: when you clock in or out of a shift, the app reads your device's GPS position once, compares it with the worksite, and stores the coordinates, the distance, and the time. We do not track your location in the background or between clock events.`,
        `Approximate location for distance: with your permission, the app may read your device location, or use the home location on your profile, to show how far shifts or Workers are from you, to sort results, and to send saved-search alerts for nearby shifts. Posters see a Worker's distance, not the Worker's coordinates; other users see profile locations rounded to roughly one kilometer.`,
        `Device and push information: device type, operating system, browser, app version, language, time zone, push notification tokens (web push endpoints and Apple device tokens), and crash or error reports.`,
        `Usage and log data: pages and screens viewed, features used, search filters, shifts viewed and applied to, taps on notifications, timestamps, IP address, and referring URLs. Our hosting and database providers keep standard server logs.`,
        `Cookies and local storage: we use essential browser or device storage only, to keep you signed in, remember your preferences (such as a chosen tab or a dismissed hint), cache data so the app opens quickly, and register push notifications. We set no advertising, analytics or tracking cookies and use no third-party tracking pixels. Our Cookie & Local Storage Policy lists every item.`,
        `Timesheet and shift events: clock-in and clock-out times, breaks, manual entries, adjustments, approvals, disputes, swaps, cancellations, no-shows, and arrival statuses.`,
      ],
      links: [{ label: 'Cookie & Local Storage Policy', page: 'cookies' }],
    },
    {
      id: 'collect-third-party',
      heading: '3. Information from other people and sources',
      paragraphs: [
        `Other users provide information about you when they rate or review you, mark your arrival status, approve or adjust your timesheet, add you to a roster, mention you in a post or comment, or send you a message. Sign-in providers (Google, Apple) share basic account details when you use them to log in. Payment processors tell us whether a payment succeeded. We do not buy data about you from data brokers and we do not run background checks.`,
      ],
    },
    {
      id: 'use',
      heading: '4. How we use information',
      paragraphs: [
        `We use the information we collect to:`,
      ],
      bullets: [
        `Create and secure your account, authenticate you, and let you sign in across devices.`,
        `Operate the marketplace: display shifts and profiles, process applications, instant claims, waitlists, offers, assignments, swaps, and cancellations, and connect Workers with Posters.`,
        `Verify attendance and hours through geofenced clock-in and clock-out, build timesheets, and support approvals, adjustments, and disputes.`,
        `Record and, where enabled, process payments and subscriptions, send receipts, and detect fraud and chargebacks.`,
        `Deliver messages, posts, stories, comments, and notifications (push, in-app, and email) you have chosen to receive, and keep you informed about bookings, shift changes, timesheets, payments, and security.`,
        `Generate match insights and suggestions (see Section 5), saved-search alerts, and calendar exports.`,
        `Show maps, distances, and directions.`,
        `Provide support, respond to your requests, and resolve disputes between users on request.`,
        `Understand how the Platform is used, fix problems, and improve features, using aggregate or de-identified data where possible.`,
        `Enforce our Terms, protect the rights, safety, and property of users and the public, detect abuse, spam, and fraud, and comply with law.`,
      ],
    },
    {
      id: 'automated',
      heading: '5. Automated matching',
      paragraphs: [
        `The Platform may show a "match" score or insight suggesting how well a shift fits a Worker, or how well a Worker fits a shift. These are produced in two ways. First, by rules we run ourselves, such as whether your skills, distance, availability, and pay expectations fit the posting. Second, by an automated processor operated by Anthropic, to which we send non-identifying signals about the shift (title, role, event type, date and time, requirements, description) and about each candidate Worker (a random account identifier, skills, certifications, rating and review count, distance to the worksite in miles, shifts worked, shifts with this Poster, no-shows and on-time rate, availability that day). We do not send names, usernames, bios, email addresses, phone numbers, photos, messages, or precise locations to that processor, and the processor is contractually prohibited from using the signals to train its models or for its own purposes.`,
        `Match insights are informational. No booking, payment, suspension, or other decision with legal or similarly significant effects is made solely by an automated system: Posters decide whom to book, Workers decide which shifts to take, and any account action is taken by a person on our team. You may ask us how a match insight about you was produced, and you may ask a person to review any decision you believe was influenced by it, by contacting ${EMAIL}.`,
      ],
    },
    {
      id: 'legal-bases',
      heading: '6. Legal bases',
      paragraphs: [
        `Where a law requires us to have a legal basis for processing, we rely on: performance of our contract with you (the Terms), to provide the Platform you asked for; our legitimate interests, such as securing the Platform, preventing fraud, improving features, and communicating with you, balanced against your rights; your consent, for things like reading your precise location, sending push notifications, and optional profile details, which you can withdraw at any time; and compliance with legal obligations, such as responding to lawful requests and keeping tax or payment records.`,
      ],
    },
    {
      id: 'sharing',
      heading: '7. How we share information',
      paragraphs: [
        `With the other side of a shift. Staffing a shift requires sharing information between Workers and Posters. When a Worker applies to, claims, or is assigned a shift, the Poster sees the Worker's username or display name, photo, bio, skills, certifications, rating and reviews, distance to the worksite, and reliability indicators. Once booked, the Poster also sees the Worker's arrival status, clock-in and clock-out times, distance at clock-in, timesheet, and messages exchanged through the Platform. Workers see the Poster's business name, photo, rating, shift details, point of contact, and the worksite address. Staffers see this information for Workers on their roster and for the shifts they manage. Each party's reviews of the other are visible to other users.`,
        `With other users generally. Your username, photo, bio, skills, rating, approximate location, posts, stories, comments, likes, follows, and hashtags are visible to other signed-in users of the Platform. Your email address, phone number, precise location, payment details, timesheets, and private messages are not shown publicly.`,
        `With service providers (processors) acting on our behalf, under contracts that limit what they may do with your information:`,
      ],
      bullets: [
        `Supabase: database, authentication, and file storage, hosted in the United States.`,
        `Vercel: hosting of the web app and API, and request logs.`,
        `Resend: transactional email delivery.`,
        `Stripe: payment processing and subscription billing, where enabled.`,
        `Anthropic: automated-matching processor, receiving the non-identifying signals described in Section 5.`,
        `Apple: push notifications to iOS devices and Safari, and Apple Maps map rendering; Apple may receive device tokens and the map areas requested.`,
        `Google: web fonts served from Google Fonts, which receive your IP address when fonts load; and, if you enable web push in Chrome or Edge, delivery of those notifications through Google's push service, which receives your push endpoint and an encrypted payload it cannot read.`,
        `Mozilla: delivery of web push notifications you enable in Firefox, on the same terms.`,
        `OpenStreetMap contributors and CARTO: map tiles, which receive the map areas requested and your IP address.`,
        `Nominatim (OpenStreetMap Foundation): address search when you type a venue or profile address; it receives the address text and your IP address.`,
        `Unsplash: the default cover photo on a shift that has no photo of its own; it receives the image request and your IP address.`,
      ],
      after: [
        `Our Cookie & Local Storage Policy describes what each of these services sees when the app loads. The full list, with what each one receives, is also published in our third-party inventory on request.`,
      ],
      links: [{ label: 'Cookie & Local Storage Policy', page: 'cookies' }],
    },
    {
      id: 'sharing-other',
      heading: '8. Other sharing',
      paragraphs: [
        `Legal requests and safety. We may disclose information if we believe in good faith that doing so is required by law, subpoena, court order, or government request; to enforce our Terms; to detect, prevent, or address fraud, security, or technical issues; or to protect the rights, property, or safety of ${C}, our users, or the public. Where permitted, we will try to notify you of a legal request for your information.`,
        `Business transfers. If ${C} is involved in a merger, acquisition, financing, reorganization, bankruptcy, or sale of all or part of its assets, your information may be transferred as part of that transaction, subject to this Policy, and we will notify you of any change in ownership or in how your information is used.`,
        `With your direction. We share information when you ask us to, for example when you export a shift to your calendar (Google Calendar or an .ics file), open directions in Apple Maps, Google Maps or Waze, share a post, or connect a third-party service. When you paste a link in chat, our server (not your device) fetches that page once to show its title and preview image, so the linked site sees our server's address rather than yours.`,
        `Aggregate or de-identified data. We may share statistics that do not identify you, such as the number of shifts filled in a city.`,
        `We do not sell your personal information, and we do not share it for cross-context behavioral advertising.`,
      ],
    },
    {
      id: 'retention',
      heading: '9. How long we keep information',
      paragraphs: [
        `We keep your information for as long as your account is active and as needed to provide the Platform. After you delete your account, we delete or de-identify your profile, posts, stories, comments, messages, push tokens, and location records within 30 days, except that we keep: records of shifts, timesheets, payments, and disputes for up to seven years where needed for tax, accounting, or legal-claim purposes; copies of your Content that other users already received, such as messages in their inbox and reviews on their profile (shown without your name); records needed to enforce our Terms or to prevent someone we have removed from returning; and routine backups, which are overwritten on a rolling basis. Clock-in coordinates are kept with the timesheet they verify. Server logs are kept for a limited period for security and debugging.`,
      ],
    },
    {
      id: 'security',
      heading: '10. Security',
      paragraphs: [
        `We use technical and organizational measures designed to protect your information, including encryption in transit (TLS) and at rest, hashed passwords, row-level access controls in our database, short-lived signed URLs for private files, rate limiting, and access limited to the people who need it. No system is completely secure, and we cannot guarantee that unauthorized access, loss, or misuse will never occur. Keep your password private, use a unique password, and tell us right away at ${EMAIL} if you suspect a problem with your account.`,
      ],
    },
    {
      id: 'choices',
      heading: '11. Your choices',
      paragraphs: [
        `You control much of your information directly in the app:`,
      ],
      bullets: [
        `Profile: edit or remove profile details, photos, skills, location, and availability in Edit Profile at any time. A profile location is optional: it is used only to show distances, and other users see it rounded to about one kilometer.`,
        `Notifications: turn push, in-app, and email notifications on or off in Settings → Notifications, and manage saved-search alerts there. Service and security messages may still be sent.`,
        `Location: control the app's access to your location in your device or browser settings. If you turn it off, distance features will use your profile location or be unavailable, and clock-in may require Poster approval of a manual entry.`,
        `Posts, stories, and messages: delete your own posts, stories, and comments at any time; messages you delete are removed from the conversation for both parties.`,
        `Blocking: block another user to stop them from messaging you or seeing your profile.`,
        `Download your data: Settings → Legal → Download my data gives you a copy of your profile, applications, timesheets, payments, reviews given and received, posts, the messages you sent, notifications and legal acceptances as a JSON file, at any time and without asking us.`,
        `Delete your account: Settings → Delete account removes your profile and data as described in Section 9. Deletion is refused only while you have an upcoming booking or an open posted shift.`,
        `Email: every email we send has a one-click unsubscribe link, and Settings → Notifications → Email notifications turns them off for good. Service and security messages may still be sent.`,
        `Privacy request: for anything else, including a correction or a request on behalf of someone else, email ${EMAIL} with the subject "Privacy request" from the address on your account; we answer within the time the law requires (45 days in California).`,
      ],
    },
    {
      id: 'california',
      heading: '12. California privacy rights',
      paragraphs: [
        `This section applies to California residents and supplements the rest of this Policy. It describes our practices under the California Consumer Privacy Act as amended by the California Privacy Rights Act (together, the "CCPA").`,
        `Categories of personal information we collect, and have collected in the past 12 months: identifiers (name, username, email, IP address, device identifiers, push tokens); personal information described in Cal. Civ. Code § 1798.80 (name, contact details, and, for payments processed through Stripe, tokenized payment information); characteristics of protected classifications only to the extent you choose to include them in your profile or Content; commercial information (shifts posted, booked, worked, and paid, subscription status); internet or network activity (usage and log data); geolocation data (precise location at clock-in and clock-out; approximate location for distance); audio and visual information (photos, videos, and audio you upload); professional or employment-related information (skills, certifications, work history on the Platform, ratings, timesheets); and inferences drawn from the above (match insights). We collect these from you, from your devices, from other users, and from the providers listed in Section 7, for the business purposes described in Section 4.`,
        `We disclose each of these categories to the service providers listed in Section 7 for business purposes, and share the categories described in Section 7 with other users as needed to staff shifts. We do not sell personal information, we do not share it for cross-context behavioral advertising, and we have no actual knowledge of selling or sharing the personal information of anyone under 16. We do not use or disclose sensitive personal information for purposes other than those permitted by the CCPA (such as providing the services you request and preventing fraud), so we do not offer a separate "limit the use of my sensitive personal information" control.`,
        `Your rights. Subject to certain exceptions, you have the right to: know what personal information we have collected about you, including the categories and specific pieces, the sources, our purposes, and the categories of third parties with whom we disclose it; delete personal information we collected from you; correct inaccurate personal information; receive a portable copy of your information; and not be discriminated against for exercising these rights. We will not deny you services, charge a different price, or provide a different level of quality because you exercised a right.`,
        `How to exercise your rights. Email ${EMAIL} with the subject "California privacy request," use Settings → Legal → Download my data for a portable copy, or use Settings → Delete account for deletion. We will verify your request by confirming that you control the email address on the account (and may ask for additional information for sensitive requests). You may designate an authorized agent to make a request on your behalf; we will ask the agent for written permission signed by you and may ask you to verify your identity directly with us. We respond within 45 days and will tell you if we need up to 45 more.`,
        `Notice of Financial Incentive: we do not offer financial incentives in exchange for personal information. Shine the Light: California Civil Code § 1798.83 permits residents to request information about disclosure of personal information to third parties for their direct marketing purposes; we do not disclose personal information to third parties for their direct marketing.`,
      ],
    },
    {
      id: 'other-states',
      heading: '13. Other U.S. state privacy rights',
      paragraphs: [
        `If you live in a state with a comprehensive privacy law, such as Colorado, Connecticut, Delaware, Indiana, Iowa, Kentucky, Maryland, Minnesota, Montana, Nebraska, New Hampshire, New Jersey, Oregon, Rhode Island, Tennessee, Texas, Utah, or Virginia, you may have the right to confirm whether we process your personal data, to access it, to correct inaccuracies, to delete it, to obtain a portable copy, and to opt out of targeted advertising, the sale of personal data, and profiling in furtherance of decisions that produce legal or similarly significant effects. We do not sell personal data, do not engage in targeted advertising, and do not make such decisions solely by automated means. To exercise your rights, email ${EMAIL}. If we deny your request, you may appeal by replying to our response with "Appeal" in the subject line; we will respond within the time your state's law requires and will tell you how to contact your state attorney general if you are not satisfied.`,
      ],
    },
    {
      id: 'children',
      heading: '14. Children',
      paragraphs: [
        `The Platform is for adults. You must be at least 18 to create an account, and you confirm that you are when you sign up; we do not ask for a date of birth or other proof because we do not want to collect more than we need. We do not knowingly collect personal information from anyone under 18, and in particular not from children under 13 as defined by the Children's Online Privacy Protection Act (COPPA). An account we find to belong to someone under 18 is deleted, together with the information it holds, as soon as we learn of it. If you believe a minor has provided us information, contact ${EMAIL}.`,
      ],
    },
    {
      id: 'dnt',
      heading: '15. Do Not Track and opt-out signals',
      paragraphs: [
        `Because we do not track users across third-party sites or sell or share personal information for advertising, there is nothing for a Do Not Track or Global Privacy Control signal to turn off, and the Platform behaves the same whether or not your browser sends one. If that changes we will update this Policy and honor recognized opt-out preference signals as the law requires.`,
      ],
    },
    {
      id: 'international',
      heading: '16. Users outside the United States',
      paragraphs: [
        `The Platform is operated from the United States and is intended for use in the United States. If you access it from elsewhere, your information will be transferred to, stored, and processed in the United States and in any other country where our service providers operate, where privacy laws may differ from those of your country. By using the Platform you consent to that transfer. If you are in a jurisdiction that grants you additional rights, such as the EEA or the United Kingdom, you may exercise them by contacting ${EMAIL}, and we will apply the appropriate safeguards for any transfer.`,
      ],
    },
    {
      id: 'changes',
      heading: '17. Changes to this Policy',
      paragraphs: [
        `We may update this Policy from time to time. When we make a material change we will post the new version with a new effective date, notify you by email or in-app notice, and ask you to acknowledge the updated Policy the next time you open the app. Your continued use of the Platform after the change takes effect means you accept it. Earlier versions are available on request.`,
      ],
    },
    {
      id: 'contact',
      heading: '18. Contact us',
      paragraphs: [
        `Questions, requests, or complaints about privacy can be sent to ${C} at ${EMAIL} or by mail to: ${LEGAL.mailingAddress}. ${C} is currently operated by an individual and a small team based in ${LEGAL.governingLaw}, United States. ${LEGAL.entityNote}.`,
      ],
    },
  ],
};
